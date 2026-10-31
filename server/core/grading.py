"""Quality grading and defect classification engine based on USDA / Commercial Egg Standards."""

from dataclasses import dataclass, field
from enum import Enum


class EggGrade(str, Enum):
    GRADE_A = "Grade A"
    GRADE_B = "Grade B"
    REJECT = "Reject"


class DefectType(str, Enum):
    CRACK = "crack"
    DIRT_STAIN = "dirt_stain"
    BLOOD_SPOT = "blood_spot"
    SHAPE_DEFORMITY = "shape_deformity"
    ROUGH_TEXTURE = "rough_texture"
    CLEAN = "clean"


@dataclass
class DefectDetection:
    defect_type: DefectType
    confidence: float                  # 0.0 - 1.0
    severity: str                      # "low", "medium", "critical"
    bbox: list[int]                    # [x, y, w, h] in cropped ROI coordinates
    area_ratio: float                  # Fraction of egg surface affected (0.0 - 1.0)
    description: str


@dataclass
class GradingResult:
    grade: EggGrade
    quality_score: float               # 0.0 to 100.0
    is_acceptable: bool                # True for commercial Grade A / B
    defects: list[DefectDetection] = field(default_factory=list)
    recommendation: str = ""
    summary_reasons: list[str] = field(default_factory=list)


def evaluate_egg_grade(defects: list[DefectDetection], base_quality_score: float = 100.0) -> GradingResult:
    """Evaluates the final grade and market admissibility of an inspected egg.

    Commercial Rules:
    - Any structural crack or fissure immediately results in 'Reject'.
    - Severe dirt (> 5% surface) or blood contamination results in 'Reject'.
    - Minor surface stains (< 3% area) or slight roughness downgrade to 'Grade B'.
    - Clean shell with no major defects qualifies as 'Grade A'.
    """
    reasons = []
    has_critical_defect = False
    has_minor_defect = False
    
    score = base_quality_score

    for defect in defects:
        if defect.defect_type == DefectType.CRACK:
            has_critical_defect = True
            reasons.append(f"Structural shell crack detected (confidence: {defect.confidence:.0%})")
            score -= 50.0 * defect.confidence
            
        elif defect.defect_type in (DefectType.DIRT_STAIN, DefectType.BLOOD_SPOT):
            if defect.severity == "critical" or defect.area_ratio > 0.05:
                has_critical_defect = True
                reasons.append(f"Heavy organic contamination / stain ({defect.area_ratio:.1%} surface area)")
                score -= 40.0 * defect.confidence
            else:
                has_minor_defect = True
                reasons.append(f"Minor superficial stain ({defect.area_ratio:.1%} surface area)")
                score -= 15.0 * defect.confidence

        elif defect.defect_type == DefectType.SHAPE_DEFORMITY:
            if defect.severity == "critical":
                has_critical_defect = True
                reasons.append("Severe shell misshapen / structural asymmetry")
                score -= 30.0 * defect.confidence
            else:
                has_minor_defect = True
                reasons.append("Slight shape irregularity")
                score -= 10.0 * defect.confidence

    score = max(0.0, min(100.0, score))

    if has_critical_defect:
        grade = EggGrade.REJECT
        is_acceptable = False
        recommendation = "DISCARD: Structural damage or severe contamination detected. Not suitable for consumption."
    elif has_minor_defect or score < 85.0:
        grade = EggGrade.GRADE_B
        is_acceptable = True
        recommendation = "GRADE B: Minor superficial flaws. Suitable for immediate cooking or food manufacturing."
    else:
        grade = EggGrade.GRADE_A
        is_acceptable = True
        recommendation = "GRADE A: Excellent quality. Shell intact, clean, and structurally sound."
        if not reasons:
            reasons.append("Shell is pristine, uniform, and structurally sound.")

    return GradingResult(
        grade=grade,
        quality_score=round(score, 1),
        is_acceptable=is_acceptable,
        defects=defects,
        recommendation=recommendation,
        summary_reasons=reasons
    )

