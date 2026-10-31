"""Pydantic request and response schemas for Egg Anomaly Inspection API."""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class DefectResponseItem(BaseModel):
    defect_type: str = Field(..., description="Type of defect ('crack', 'dirt_stain', 'blood_spot', 'shape_deformity')")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    severity: str = Field(..., description="Severity level: 'low', 'medium', or 'critical'")
    bbox: List[int] = Field(..., description="Bounding box [x, y, w, h] in ROI coordinates")
    area_ratio: float = Field(..., description="Percentage of egg surface affected")
    description: str = Field(..., description="Human-readable defect description")


class InspectionResponse(BaseModel):
    filename: Optional[str] = Field(None, description="Original filename of inspected image")
    egg_detected: bool = Field(..., description="Whether an egg was detected in the frame")
    detection_confidence: float = Field(..., description="Confidence of egg presence")
    grade: str = Field(..., description="Commercial grade: 'Grade A', 'Grade B', or 'Reject'")
    quality_score: float = Field(..., ge=0.0, le=100.0, description="Overall quality score (0 - 100)")
    is_acceptable: bool = Field(..., description="True if fit for commercial sale (Grade A or B)")
    recommendation: str = Field(..., description="Actionable recommendation (Eat, Process, or Discard)")
    reasons: List[str] = Field(default_factory=list, description="Detailed audit reasons for the assigned grade")
    defects: List[DefectResponseItem] = Field(default_factory=list, description="List of localized defects")
    aspect_ratio: float = Field(..., description="Geometric aspect ratio of egg")
    solidity: float = Field(..., description="Geometric solidity / convexity ratio")
    processing_time_ms: float = Field(..., description="Inference latency in milliseconds")
    annotated_image_data: Optional[str] = Field(None, description="Base64 encoded data URI with annotations")
    heatmap_data: Optional[str] = Field(None, description="Base64 encoded anomaly heatmap overlay")


class BatchInspectionSummary(BaseModel):
    total_inspected: int
    grade_a_count: int
    grade_b_count: int
    reject_count: int
    pass_rate_percentage: float
    defect_breakdown: Dict[str, int]
    total_processing_time_ms: float
    items: List[InspectionResponse]


class EnterpriseMetricsResponse(BaseModel):
    total_inspections: int
    pass_rate_percentage: float
    grade_distribution: Dict[str, int]
    defect_frequencies: Dict[str, int]
    uptime_seconds: float
    active_engine: str


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    engine_ready: bool
