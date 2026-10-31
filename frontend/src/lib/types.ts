/**
 * Core type definitions for EggScan Enterprise Frontend.
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
  grade: "Grade A" | "Grade B" | "Reject";
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

