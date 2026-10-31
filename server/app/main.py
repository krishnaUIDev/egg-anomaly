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
)
from core.anomaly_engine import EggAnomalyEngine, encode_image_base64
from core.grading import EggGrade, evaluate_egg_grade
from core.preprocessing import fix_exif_orientation, isolate_egg_roi
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
