"""Pydantic request and response schemas for Egg Anomaly Inspection API."""


from pydantic import BaseModel, Field


class DefectResponseItem(BaseModel):
    defect_type: str = Field(..., description="Type of defect ('crack', 'dirt_stain', 'blood_spot', 'shape_deformity')")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    severity: str = Field(..., description="Severity level: 'low', 'medium', or 'critical'")
    bbox: list[int] = Field(..., description="Bounding box [x, y, w, h] in ROI coordinates")
    area_ratio: float = Field(..., description="Percentage of egg surface affected")
    description: str = Field(..., description="Human-readable defect description")


class InspectionResponse(BaseModel):
    filename: str | None = Field(None, description="Original filename of inspected image")
    egg_detected: bool = Field(..., description="Whether an egg was detected in the frame")
    detection_confidence: float = Field(..., description="Confidence of egg presence")
    grade: str = Field(..., description="Commercial grade: 'Grade A', 'Grade B', or 'Reject'")
    quality_score: float = Field(..., ge=0.0, le=100.0, description="Overall quality score (0 - 100)")
    is_acceptable: bool = Field(..., description="True if fit for commercial sale (Grade A or B)")
    recommendation: str = Field(..., description="Actionable recommendation (Eat, Process, or Discard)")
    reasons: list[str] = Field(default_factory=list, description="Detailed audit reasons for the assigned grade")
    defects: list[DefectResponseItem] = Field(default_factory=list, description="List of localized defects")
    aspect_ratio: float = Field(..., description="Geometric aspect ratio of egg")
    solidity: float = Field(..., description="Geometric solidity / convexity ratio")
    processing_time_ms: float = Field(..., description="Inference latency in milliseconds")
    annotated_image_data: str | None = Field(None, description="Base64 encoded data URI with annotations")
    heatmap_data: str | None = Field(None, description="Base64 encoded anomaly heatmap overlay")


class BatchInspectionSummary(BaseModel):
    total_inspected: int
    grade_a_count: int
    grade_b_count: int
    reject_count: int
    pass_rate_percentage: float
    defect_breakdown: dict[str, int]
    total_processing_time_ms: float
    items: list[InspectionResponse]


class SingleTrayEggSummary(BaseModel):
    egg_id: int = Field(..., description="1-indexed sequence identifier on tray")
    bbox: list[int] = Field(..., description="[x, y, w, h] coordinates on full tray")
    row: int = Field(0, description="0-indexed row position in tray matrix")
    col: int = Field(0, description="0-indexed column position in tray matrix")
    pocket_label: str = Field("", description="Human-readable pocket coordinate, e.g. 'R1-C3'")
    grade: str = Field(..., description="'Grade A', 'Grade B', or 'Reject'")
    quality_score: float = Field(..., description="Quality score 0 - 100")
    is_acceptable: bool = Field(..., description="True if fit for commercial sale")
    defect_count: int = Field(..., description="Number of defects found")
    defects: list[DefectResponseItem] = Field(default_factory=list)
    recommendation: str = Field(..., description="Action recommendation")
    actuator_action: str = Field("PASS", description="PLC actuator command: 'PASS' | 'DIVERT_CHUTE_1' | 'DIVERT_CHUTE_2' | 'DIVERT_CHUTE_3'")
    chute_target: str = Field("Main Packing", description="Designated packaging or diversion lane")


class PlcActuatorSignal(BaseModel):
    pocket_label: str = Field(..., description="Grid coordinate of egg pocket (e.g. 'R0-C2')")
    egg_id: int = Field(..., description="Tray egg sequence identifier")
    row: int = Field(..., description="Tray matrix row")
    col: int = Field(..., description="Tray matrix column")
    grade: str = Field(..., description="Assigned grade")
    primary_defect: str | None = Field(None, description="Primary trigger defect")
    actuator_action: str = Field(..., description="'DIVERT_CHUTE_1' | 'DIVERT_CHUTE_2' | 'DIVERT_CHUTE_3'")
    solenoid_valve_id: int = Field(..., description="Hardware pneumatic valve / finger ID")
    target_chute: str = Field(..., description="Destination diversion lane")
    encoder_pulse_offset: int = Field(..., description="Rotary encoder pulse target for exact belt position")
    trigger_delay_ms: int = Field(..., description="Milliseconds after optical trip before actuator fires")


class TrayInspectionResponse(BaseModel):
    filename: str | None = Field(None, description="Original filename")
    total_eggs_detected: int = Field(..., description="Count of segmented eggs")
    grade_distribution: dict[str, int] = Field(..., description="Counts per grade")
    tray_pass_rate_percentage: float = Field(..., description="Percentage of marketable eggs")
    grade_a_count: int = Field(0)
    grade_b_count: int = Field(0)
    reject_count: int = Field(0)
    annotated_tray_image: str = Field(..., description="Base64 encoded JPEG overlay of entire tray with numbered rings")
    eggs: list[SingleTrayEggSummary] = Field(default_factory=list, description="Detailed analysis per egg")
    processing_time_ms: float = Field(..., description="Inference latency in milliseconds")
    plc_signals: list[PlcActuatorSignal] = Field(default_factory=list, description="Downstream PLC fieldbus actuator triggers")


class EnterpriseMetricsResponse(BaseModel):
    total_inspections: int
    pass_rate_percentage: float
    grade_distribution: dict[str, int]
    defect_frequencies: dict[str, int]
    uptime_seconds: float
    active_engine: str


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    engine_ready: bool
