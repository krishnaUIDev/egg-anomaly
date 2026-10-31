/**
 * Core type definitions for OvoGrade Enterprise AI.
 */

export interface DefectItem {
  defect_type: string;
  confidence: number;
  severity: "low" | "medium" | "critical";
  bbox: [number, number, number, number]; // [x, y, w, h]
  area_ratio: number;
  description: string;
}

export interface InspectionResult {
  filename?: string;
  egg_detected: boolean;
  detection_confidence: number;
  grade: "Grade A" | "Grade B" | "Reject" | string;
  quality_score: number;
  is_acceptable: boolean;
  recommendation: string;
  reasons: string[];
  defects: DefectItem[];
  aspect_ratio: number;
  solidity: number;
  processing_time_ms: number;
  annotated_image_data?: string;
  heatmap_data?: string;
}

export interface BatchSummary {
  total_inspected: number;
  grade_a_count: number;
  grade_b_count: number;
  reject_count: number;
  pass_rate_percentage: number;
  defect_breakdown: Record<string, number>;
  total_processing_time_ms: number;
  items: InspectionResult[];
}

export interface EnterpriseMetrics {
  total_inspections: number;
  pass_rate_percentage: number;
  grade_distribution: Record<string, number>;
  defect_frequencies: Record<string, number>;
  uptime_seconds: number;
  active_engine: string;
}

export interface SampleEgg {
  id: string;
  label: string;
  expected: "Grade A" | "Grade B" | "Reject";
  badgeClass: string;
}

export type ViewLayer = "annotated" | "heatmap" | "original";
export type ActiveTab = "single" | "batch" | "analytics";

export interface OvoEggScenario {
  sampleName: string;
  grade:
    | "AA"
    | "A"
    | "B"
    | "B / Check"
    | "Inedible / Loss"
    | "Dirty / Downgraded"
    | "Loss / Leaker"
    | string;
  confidence: number;
  airCellMm: number;
  airCellInch: string;
  shellCondition: string;
  cracksDetected: boolean;
  crackSeverity: number;
  bloodSpotDetected: boolean;
  bloodSpotMm: number;
  dirtPercentage: number;
  weightGrams: number;
  yolkCentering: string;
}

export interface LotStats {
  totalInspected: number;
  gradeAA: number;
  gradeA: number;
  gradeB: number;
  loss: number;
}

export interface LogEntry {
  id: string;
  time: string;
  sku: string;
  name: string;
  grade: string;
  weight: string;
}
