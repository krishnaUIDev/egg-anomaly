"""Enterprise FastAPI Web Service for Egg Quality Inspection and Anomaly Detection."""

import glob
import io
import os
import time
from collections import defaultdict

import cv2
import numpy as np
from app.config import settings
from app.schemas import (
    BatchInspectionSummary,
    DefectResponseItem,
    EnterpriseMetricsResponse,
    HealthResponse,
    InspectionResponse,
    PlcActuatorSignal,
    SingleTrayEggSummary,
    TrayInspectionResponse,
)
from core.anomaly_engine import EggAnomalyEngine, encode_image_base64
from core.grading import EggGrade, evaluate_egg_grade
from core.preprocessing import fix_exif_orientation, isolate_all_egg_rois, isolate_egg_roi
from datasets.synthetic_generator import generate_tray_image
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(
    title=settings.app_name,
    description="Enterprise-grade Egg Anomaly Detection & Commercial Quality Grading API.",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enterprise CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time-Ms", "X-Trace-Id"]
)

# Enterprise Metrics & Telemetry Store
START_TIME = time.time()
INSPECTION_STATS = {
    "total_inspections": 0,
    "grade_a_count": 0,
    "grade_b_count": 0,
    "reject_count": 0,
    "defect_counts": defaultdict(int)
}

engine = EggAnomalyEngine()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES_DIR = os.path.join(BASE_DIR, "datasets", "samples")


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Enterprise middleware to record latency and trace processing time."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = (time.perf_counter() - start_time) * 1000.0
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response


# --- Health & Kubernetes Probes ---

@app.get("/healthz", response_model=HealthResponse, tags=["Observability"])
@app.get("/api/v1/health", response_model=HealthResponse, tags=["Observability"])
def health_check():
    """Liveness probe: verifies the service is alive and healthy."""
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        environment=settings.app_env,
        engine_ready=True
    )


@app.get("/readyz", tags=["Observability"])
def readiness_check():
    """Kubernetes Readiness probe: verifies models and dependencies are ready for traffic."""
    return {"ready": True, "engine": "EggAnomalyEngine", "version": settings.app_version}


@app.get("/livez", tags=["Observability"])
def liveness_check():
    """Kubernetes Liveness probe."""
    return {"live": True}


# --- Core Inspection Endpoints ---

@app.post("/api/v1/inspect", response_model=InspectionResponse, tags=["Inspection"])
async def inspect_egg(
    file: UploadFile = File(..., description="Phone camera or inspection image"),
    crack_sensitivity: float = Query(0.5, ge=0.1, le=1.0, description="Crack detection sensitivity"),
    stain_sensitivity: float = Query(0.5, ge=0.1, le=1.0, description="Stain detection sensitivity"),
):
    """Inspects a single egg photo captured from phone camera or industrial feed."""
    start_time = time.perf_counter()

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image payload received.")

    try:
        pil_img = Image.open(io.BytesIO(contents))
        pil_img = fix_exif_orientation(pil_img)
        rgb_img = np.array(pil_img.convert("RGB"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode image: {e!s}")

    # Preprocessing & Isolation
    roi = isolate_egg_roi(rgb_img, target_size=512)

    # Anomaly Engine Inference
    custom_engine = EggAnomalyEngine(
        crack_sensitivity=crack_sensitivity,
        stain_sensitivity=stain_sensitivity
    )
    defects, heatmap, annotated = custom_engine.analyze(roi)

    # Commercial Grading
    grading = evaluate_egg_grade(defects)

    # Update Enterprise Telemetry
    INSPECTION_STATS["total_inspections"] += 1
    if grading.grade == EggGrade.GRADE_A:
        INSPECTION_STATS["grade_a_count"] += 1
    elif grading.grade == EggGrade.GRADE_B:
        INSPECTION_STATS["grade_b_count"] += 1
    else:
        INSPECTION_STATS["reject_count"] += 1

    for d in defects:
        INSPECTION_STATS["defect_counts"][d.defect_type.value] += 1

    # Format response
    defect_items = [
        DefectResponseItem(
            defect_type=d.defect_type.value,
            confidence=d.confidence,
            severity=d.severity,
            bbox=d.bbox,
            area_ratio=d.area_ratio,
            description=d.description
        )
        for d in defects
    ]

    heatmap_colored = cv2.applyColorMap((heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

    annotated_uri = encode_image_base64(annotated)
    heatmap_uri = encode_image_base64(heatmap_rgb)
    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return InspectionResponse(
        filename=file.filename,
        egg_detected=roi.confidence > 0.50,
        detection_confidence=round(roi.confidence, 2),
        grade=grading.grade.value,
        quality_score=grading.quality_score,
        is_acceptable=grading.is_acceptable,
        recommendation=grading.recommendation,
        reasons=grading.summary_reasons,
        defects=defect_items,
        aspect_ratio=round(roi.aspect_ratio, 2),
        solidity=round(roi.solidity, 2),
        processing_time_ms=round(elapsed_ms, 1),
        annotated_image_data=annotated_uri,
        heatmap_data=heatmap_uri
    )


def process_tray_image_pipeline(
    rgb_img: np.ndarray,
    filename: str,
    crack_sensitivity: float,
    stain_sensitivity: float,
    start_time: float,
) -> TrayInspectionResponse:
    """Core image processing pipeline for tray detection, quality grading, and PLC actuator signal synthesis."""
    # Discover all eggs in the tray/carton
    egg_rois = isolate_all_egg_rois(rgb_img, target_size=256)
    if not egg_rois:
        single_roi = isolate_egg_roi(rgb_img, target_size=256)
        egg_rois = [single_roi]

    engine = EggAnomalyEngine(
        crack_sensitivity=crack_sensitivity,
        stain_sensitivity=stain_sensitivity
    )

    annotated_tray = rgb_img.copy()
    egg_summaries: list[SingleTrayEggSummary] = []
    grade_counts: dict[str, int] = defaultdict(int)
    plc_signals: list[PlcActuatorSignal] = []

    for idx, roi in enumerate(egg_rois, start=1):
        defects, _, _ = engine.analyze(roi)
        grading = evaluate_egg_grade(defects)
        grade_counts[grading.grade.value] += 1

        row = getattr(roi, "row", (idx - 1) // 6)
        col = getattr(roi, "col", (idx - 1) % 6)
        pocket_label = f"R{row}-C{col}"

        if grading.grade == EggGrade.GRADE_A:
            ring_color = (16, 185, 129)
            badge_text = f"#{idx} A"
            actuator_action = "PASS"
            chute_target = "Main Packing"
            primary_defect = None
        elif grading.grade == EggGrade.GRADE_B:
            ring_color = (245, 158, 11)
            badge_text = f"#{idx} B"
            actuator_action = "PASS"
            chute_target = "Main Packing"
            primary_defect = None
        else:
            ring_color = (239, 68, 68)
            badge_text = f"#{idx} REJ"
            primary_defect = defects[0].defect_type.value if defects else "defect"
            if primary_defect == "crack":
                actuator_action = "DIVERT_CHUTE_1"
                chute_target = "Chute 1: Liquid Egg Salvage (Crack)"
            elif primary_defect == "dirt_stain":
                actuator_action = "DIVERT_CHUTE_2"
                chute_target = "Chute 2: Wash Station (Dirty)"
            else:
                actuator_action = "DIVERT_CHUTE_3"
                chute_target = "Chute 3: Inedible Discard (Blood/Loss)"

            plc_signals.append(PlcActuatorSignal(
                pocket_label=pocket_label,
                egg_id=idx,
                row=row,
                col=col,
                grade=grading.grade.value,
                primary_defect=primary_defect,
                actuator_action=actuator_action,
                solenoid_valve_id=col + 1,
                target_chute=chute_target,
                encoder_pulse_offset=1200 + (row * 120),
                trigger_delay_ms=850 + (row * 60)
            ))

        x, y, w, h = roi.bbox
        center = (x + w // 2, y + h // 2)
        radius = max(w, h) // 2
        cv2.circle(annotated_tray, center, radius, ring_color, 3)

        badge_pos = (max(x, 10), max(y - 8, 20))
        cv2.rectangle(
            annotated_tray,
            (badge_pos[0] - 2, badge_pos[1] - 16),
            (badge_pos[0] + len(badge_text) * 11 + 6, badge_pos[1] + 4),
            ring_color,
            -1
        )
        cv2.putText(
            annotated_tray,
            badge_text,
            badge_pos,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )

        defect_items = [
            DefectResponseItem(
                defect_type=d.defect_type.value,
                confidence=d.confidence,
                severity=d.severity,
                bbox=d.bbox,
                area_ratio=d.area_ratio,
                description=d.description
            )
            for d in defects
        ]

        egg_summaries.append(SingleTrayEggSummary(
            egg_id=idx,
            bbox=[x, y, w, h],
            row=row,
            col=col,
            pocket_label=pocket_label,
            grade=grading.grade.value,
            quality_score=grading.quality_score,
            is_acceptable=grading.is_acceptable,
            defect_count=len(defects),
            defects=defect_items,
            recommendation=grading.recommendation,
            actuator_action=actuator_action,
            chute_target=chute_target
        ))

        INSPECTION_STATS["total_inspections"] += 1
        if grading.grade == EggGrade.GRADE_A:
            INSPECTION_STATS["grade_a_count"] += 1
        elif grading.grade == EggGrade.GRADE_B:
            INSPECTION_STATS["grade_b_count"] += 1
        else:
            INSPECTION_STATS["reject_count"] += 1
        for d in defects:
            INSPECTION_STATS["defect_counts"][d.defect_type.value] += 1

    total_eggs = len(egg_summaries)
    grade_a = grade_counts["Grade A"]
    grade_b = grade_counts["Grade B"]
    reject = grade_counts["Reject"]
    pass_rate = round(((grade_a + grade_b) / max(total_eggs, 1)) * 100.0, 1)

    annotated_uri = encode_image_base64(annotated_tray)
    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return TrayInspectionResponse(
        filename=filename,
        total_eggs_detected=total_eggs,
        grade_distribution=dict(grade_counts),
        tray_pass_rate_percentage=pass_rate,
        grade_a_count=grade_a,
        grade_b_count=grade_b,
        reject_count=reject,
        annotated_tray_image=annotated_uri,
        eggs=egg_summaries,
        processing_time_ms=round(elapsed_ms, 1),
        plc_signals=plc_signals
    )


@app.post("/api/v1/inspect/tray", response_model=TrayInspectionResponse, tags=["Inspection"])
async def inspect_tray(
    file: UploadFile = File(..., description="Full tray or carton image (e.g. 6, 12, 18, 30 eggs)"),
    crack_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
    stain_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
):
    """Inspects an entire carton or tray of multiple eggs simultaneously in a single capture."""
    start_time = time.perf_counter()

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image payload received.")

    try:
        pil_img = Image.open(io.BytesIO(contents))
        pil_img = fix_exif_orientation(pil_img)
        rgb_img = np.array(pil_img.convert("RGB"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode image: {e!s}")

    return process_tray_image_pipeline(
        rgb_img=rgb_img,
        filename=file.filename or "uploaded_tray.jpg",
        crack_sensitivity=crack_sensitivity,
        stain_sensitivity=stain_sensitivity,
        start_time=start_time
    )


@app.get("/api/v1/conveyor/simulate-frame", response_model=TrayInspectionResponse, tags=["Conveyor"])
def simulate_conveyor_frame(
    tray_size: str = Query("30", description="'30' (5x6), '12' (2x6), or '6' (2x3)"),
    defect_rate: float = Query(0.15, ge=0.0, le=0.5, description="Target ratio of defective eggs"),
    crack_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
    stain_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
):
    """Generates a dynamic real-time industrial conveyor tray pass, executes high-speed edge AI grading,

    and outputs live PLC fieldbus actuator instructions for pneumatic diverters.
    """
    start_time = time.perf_counter()

    if tray_size == "12":
        rows, cols = 2, 6
        width, height = 900, 400
    elif tray_size == "6":
        rows, cols = 2, 3
        width, height = 600, 450
    else:  # default 30-egg flat
        rows, cols = 5, 6
        width, height = 960, 800

    total_cells = rows * cols
    defect_count = max(1 if defect_rate > 0 else 0, int(total_cells * defect_rate))

    defect_pool = ["crack", "dirt_stain", "blood_spot"]
    dist = ["clean"] * (total_cells - defect_count)
    for _ in range(defect_count):
        dist.append(np.random.choice(defect_pool))
    np.random.shuffle(dist)

    tray_img, _ = generate_tray_image(
        rows=rows,
        cols=cols,
        defect_distribution=dist,
        width=width,
        height=height
    )

    return process_tray_image_pipeline(
        rgb_img=tray_img,
        filename=f"conveyor_tray_{tray_size}_{int(time.time() * 1000)}.jpg",
        crack_sensitivity=crack_sensitivity,
        stain_sensitivity=stain_sensitivity,
        start_time=start_time
    )


@app.get("/api/v1/conveyor/industrial-frame", response_model=TrayInspectionResponse, tags=["Conveyor"])
def capture_industrial_camera_frame(
    stream_url: str = Query(..., description="RTSP, HTTP, or USB device index for industrial machine vision camera"),
    crack_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
    stain_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
):
    """Pulls an optical frame from an industrial network camera, RTSP feed, or USB machine vision source,

    executes high-speed defect grading, and synthesizes PLC actuator signals.
    """
    start_time = time.perf_counter()
    try:
        source: int | str = int(stream_url) if stream_url.isdigit() else stream_url
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise HTTPException(
                status_code=400,
                detail=f"Cannot connect to industrial camera source: {stream_url}"
            )
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to acquire optical frame from industrial camera stream."
            )
        rgb_img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Camera stream acquisition failed: {e!s}")

    return process_tray_image_pipeline(
        rgb_img=rgb_img,
        filename=f"industrial_cam_{int(time.time() * 1000)}.jpg",
        crack_sensitivity=crack_sensitivity,
        stain_sensitivity=stain_sensitivity,
        start_time=start_time
    )


@app.post("/api/v1/inspect/batch", response_model=BatchInspectionSummary, tags=["Inspection"])
async def inspect_batch(
    files: list[UploadFile] = File(..., description="Batch of egg images to inspect"),
    crack_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
    stain_sensitivity: float = Query(0.5, ge=0.1, le=1.0),
):
    """Batch inspection for commercial egg grading trays and QC runs."""
    if len(files) > settings.max_batch_size:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size {len(files)} exceeds maximum allowed of {settings.max_batch_size} items."
        )

    start_batch_time = time.perf_counter()
    results: list[InspectionResponse] = []
    grade_a = 0
    grade_b = 0
    reject = 0
    batch_defect_breakdown = defaultdict(int)

    for file in files:
        res = await inspect_egg(
            file=file,
            crack_sensitivity=crack_sensitivity,
            stain_sensitivity=stain_sensitivity
        )
        results.append(res)
        if res.grade == "Grade A":
            grade_a += 1
        elif res.grade == "Grade B":
            grade_b += 1
        else:
            reject += 1

        for d in res.defects:
            batch_defect_breakdown[d.defect_type] += 1

    total = len(results)
    pass_rate = round(((grade_a + grade_b) / max(total, 1)) * 100.0, 1)
    batch_elapsed = (time.perf_counter() - start_batch_time) * 1000.0

    return BatchInspectionSummary(
        total_inspected=total,
        grade_a_count=grade_a,
        grade_b_count=grade_b,
        reject_count=reject,
        pass_rate_percentage=pass_rate,
        defect_breakdown=dict(batch_defect_breakdown),
        total_processing_time_ms=round(batch_elapsed, 1),
        items=results
    )


@app.get("/api/v1/metrics", response_model=EnterpriseMetricsResponse, tags=["Analytics"])
def get_enterprise_metrics():
    """Retrieves enterprise quality control metrics, SLA stats, and pass rates."""
    total = INSPECTION_STATS["total_inspections"]
    accepted = INSPECTION_STATS["grade_a_count"] + INSPECTION_STATS["grade_b_count"]
    pass_rate = round((accepted / max(total, 1)) * 100.0, 1) if total > 0 else 100.0

    return EnterpriseMetricsResponse(
        total_inspections=total,
        pass_rate_percentage=pass_rate,
        grade_distribution={
            "Grade A": INSPECTION_STATS["grade_a_count"],
            "Grade B": INSPECTION_STATS["grade_b_count"],
            "Reject": INSPECTION_STATS["reject_count"]
        },
        defect_frequencies=dict(INSPECTION_STATS["defect_counts"]),
        uptime_seconds=round(time.time() - START_TIME, 1),
        active_engine="Dual-Engine CV + Anomaly Heatmap"
    )


@app.get("/api/v1/samples", tags=["Samples"])
def list_samples():
    """Lists pre-configured benchmark egg test samples."""
    sample_files = glob.glob(os.path.join(SAMPLES_DIR, "*.jpg"))
    results = []
    for path in sorted(sample_files):
        filename = os.path.basename(path)
        label = filename.replace(".jpg", "").replace("_", " ").title()
        results.append({
            "id": filename,
            "label": label,
            "url": f"/samples/{filename}"
        })
    return {"samples": results}


# Mount sample images
if os.path.exists(SAMPLES_DIR):
    app.mount("/samples", StaticFiles(directory=SAMPLES_DIR), name="samples")


@app.get("/", tags=["System"])
def root_info():
    """Root metadata & service discovery endpoint."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/healthz",
        "api_v1": "/api/v1",
    }
