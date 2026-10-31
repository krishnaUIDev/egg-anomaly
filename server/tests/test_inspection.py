"""Unit and integration tests for the Egg Anomaly Inspection Engine."""

import numpy as np
from core.anomaly_engine import EggAnomalyEngine, encode_image_base64
from core.grading import DefectType, EggGrade, evaluate_egg_grade
from core.preprocessing import isolate_egg_roi, normalize_lighting
from datasets.synthetic_generator import generate_egg_image


def test_lighting_normalization():
    """Verifies CLAHE lighting normalization does not crash and preserves dimensions."""
    sample = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    norm = normalize_lighting(sample)
    assert norm.shape == (300, 300, 3)
    assert norm.dtype == np.uint8


def test_isolate_egg_roi():
    """Verifies that an egg on a background is correctly detected, segmented, and cropped."""
    img_rgb, _ = generate_egg_image(defect_type="clean", width=400, height=400)
    roi = isolate_egg_roi(img_rgb, target_size=256)
    
    assert roi.confidence > 0.60
    assert roi.cropped_egg_rgb.shape == (256, 256, 3)
    assert np.count_nonzero(roi.mask) > 1000
    assert roi.solidity > 0.80
    assert 1.0 < roi.aspect_ratio < 2.0


def test_clean_egg_inspection():
    """Verifies that a pristine egg receives Grade A with no critical defects."""
    img_rgb, _ = generate_egg_image(defect_type="clean", width=500, height=500)
    roi = isolate_egg_roi(img_rgb, target_size=256)
    
    engine = EggAnomalyEngine()
    defects, heatmap, annotated = engine.analyze(roi)
    grade_res = evaluate_egg_grade(defects)
    
    assert grade_res.grade in (EggGrade.GRADE_A, EggGrade.GRADE_B)
    assert grade_res.is_acceptable is True
    assert grade_res.quality_score >= 80.0
    assert annotated.shape == (256, 256, 3)


def test_crack_detection():
    """Verifies that an egg with a crack is detected and classified as Reject."""
    img_rgb, _ = generate_egg_image(defect_type="crack", width=500, height=500)
    roi = isolate_egg_roi(img_rgb, target_size=256)
    
    engine = EggAnomalyEngine()
    defects, heatmap, annotated = engine.analyze(roi)
    
    has_crack = any(d.defect_type == DefectType.CRACK for d in defects)
    assert has_crack, "Crack should be detected"
    
    grade_res = evaluate_egg_grade(defects)
    assert grade_res.grade == EggGrade.REJECT
    assert grade_res.is_acceptable is False


def test_dirt_stain_detection():
    """Verifies that an egg with surface stains is flagged."""
    img_rgb, _ = generate_egg_image(defect_type="dirt_stain", width=500, height=500)
    roi = isolate_egg_roi(img_rgb, target_size=256)
    
    engine = EggAnomalyEngine()
    defects, heatmap, annotated = engine.analyze(roi)
    
    has_stain = any(d.defect_type in (DefectType.DIRT_STAIN, DefectType.BLOOD_SPOT) for d in defects)
    assert has_stain, "Dirt stain should be detected"


def test_base64_encoder():
    """Verifies that numpy images serialize to valid base64 data URIs."""
    dummy = np.zeros((50, 50, 3), dtype=np.uint8)
    uri = encode_image_base64(dummy)
    assert uri.startswith("data:image/jpeg;base64,")

