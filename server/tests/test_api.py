"""Integration tests for Enterprise FastAPI endpoints."""

import os

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
SAMPLES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datasets", "samples")


def test_health_and_probes():
    # Root metadata endpoint
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "online"
    assert "docs_url" in res_root.json()

    # Health
    res_health = client.get("/healthz")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"

    # Liveness
    res_live = client.get("/livez")
    assert res_live.status_code == 200
    assert res_live.json()["live"] is True

    # Readiness
    res_ready = client.get("/readyz")
    assert res_ready.status_code == 200
    assert res_ready.json()["ready"] is True


def test_samples_endpoint():
    response = client.get("/api/v1/samples")
    assert response.status_code == 200
    data = response.json()
    assert "samples" in data
    assert len(data["samples"]) > 0


def test_inspect_clean_egg_endpoint():
    sample_path = os.path.join(SAMPLES_DIR, "clean_brown.jpg")
    with open(sample_path, "rb") as f:
        response = client.post(
            "/api/v1/inspect",
            files={"file": ("clean_brown.jpg", f, "image/jpeg")}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["egg_detected"] is True
    assert data["grade"] in ("Grade A", "Grade B")
    assert data["is_acceptable"] is True
    assert data["annotated_image_data"].startswith("data:image/jpeg;base64,")


def test_inspect_crack_egg_endpoint():
    sample_path = os.path.join(SAMPLES_DIR, "crack_fissure.jpg")
    with open(sample_path, "rb") as f:
        response = client.post(
            "/api/v1/inspect",
            files={"file": ("crack_fissure.jpg", f, "image/jpeg")}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["grade"] == "Reject"
    assert data["is_acceptable"] is False
    assert len(data["defects"]) > 0
    assert any(d["defect_type"] == "crack" for d in data["defects"])


def test_batch_inspection_endpoint():
    path1 = os.path.join(SAMPLES_DIR, "clean_brown.jpg")
    path2 = os.path.join(SAMPLES_DIR, "crack_fissure.jpg")

    with open(path1, "rb") as f1, open(path2, "rb") as f2:
        response = client.post(
            "/api/v1/inspect/batch",
            files=[
                ("files", ("egg1.jpg", f1, "image/jpeg")),
                ("files", ("egg2.jpg", f2, "image/jpeg")),
            ]
        )
    assert response.status_code == 200
    batch = response.json()
    assert batch["total_inspected"] == 2
    assert batch["grade_a_count"] >= 1
    assert batch["reject_count"] >= 1
    assert batch["pass_rate_percentage"] == 50.0
    assert len(batch["items"]) == 2


def test_enterprise_metrics_endpoint():
    response = client.get("/api/v1/metrics")
    assert response.status_code == 200
    metrics = response.json()
    assert metrics["total_inspections"] >= 2
    assert "Grade A" in metrics["grade_distribution"]
    assert "Reject" in metrics["grade_distribution"]
    assert metrics["uptime_seconds"] > 0


def test_tray_inspection_endpoint():
    import cv2
    from datasets.synthetic_generator import generate_tray_image

    tray_img, _ = generate_tray_image(rows=2, cols=2)
    success, encoded_jpg = cv2.imencode(".jpg", cv2.cvtColor(tray_img, cv2.COLOR_RGB2BGR))
    assert success

    response = client.post(
        "/api/v1/inspect/tray",
        files={"file": ("tray_sample.jpg", encoded_jpg.tobytes(), "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_eggs_detected"] >= 1
    assert "annotated_tray_image" in data
    assert data["annotated_tray_image"].startswith("data:image/jpeg;base64,")
    assert len(data["eggs"]) >= 1
    assert data["tray_pass_rate_percentage"] >= 0.0
    assert "plc_signals" in data
    assert "row" in data["eggs"][0]
    assert "col" in data["eggs"][0]


def test_conveyor_simulate_frame_endpoint():
    """Validates real-time industrial conveyor simulation endpoint and PLC actuator output."""
    response = client.get("/api/v1/conveyor/simulate-frame?tray_size=12&defect_rate=0.25")
    assert response.status_code == 200
    data = response.json()
    assert data["total_eggs_detected"] >= 6
    assert "plc_signals" in data
    assert "annotated_tray_image" in data
    assert data["processing_time_ms"] > 0
    # Verify PLC actuator payload structure
    # Also test standard 30-egg flat simulation
    res30 = client.get("/api/v1/conveyor/simulate-frame?tray_size=30&defect_rate=0.10")
    assert res30.status_code == 200
    data30 = res30.json()
    assert data30["total_eggs_detected"] >= 24
    assert len(data30["eggs"]) >= 24
    assert "plc_signals" in data30

