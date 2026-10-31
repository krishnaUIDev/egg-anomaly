import { BatchSummary } from "./types";

/**
 * Downloads a structured CSV audit report from batch inspection results.
 */
export function exportBatchToCSV(batch: BatchSummary) {
  const headers = [
    "Item_ID",
    "Filename",
    "Commercial_Grade",
    "Quality_Score",
    "Market_Acceptable",
    "Defects_Count",
    "Defect_Types",
    "Detection_Confidence",
    "Processing_Time_ms",
  ];

  const rows = batch.items.map((item, idx) => [
    idx + 1,
    `"${item.filename || `Egg_${idx + 1}`}"`,
    `"${item.grade}"`,
    item.quality_score,
    item.is_acceptable ? "YES" : "NO",
    item.defects.length,
    `"${item.defects.map((d) => d.defect_type).join("; ")}"`,
    item.detection_confidence,
    item.processing_time_ms,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `eggscan_qc_batch_report_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Utility for combining conditional CSS class names.
 */
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

