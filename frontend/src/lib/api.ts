import { InspectionResult, BatchSummary, EnterpriseMetrics, TrayInspectionResult } from "./types";

/**
 * Enterprise API client for EggScan backend microservice.
 */

export async function inspectSingleEgg(
  file: File,
  crackSensitivity: number,
  stainSensitivity: number
): Promise<InspectionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const query = new URLSearchParams({
    crack_sensitivity: crackSensitivity.toFixed(2),
    stain_sensitivity: stainSensitivity.toFixed(2),
  });

  const res = await fetch(`/api/v1/inspect?${query.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Inspection failed with status ${res.status}`);
  }

  return res.json();
}

export async function inspectBatchEggs(
  files: FileList | File[],
  crackSensitivity: number,
  stainSensitivity: number
): Promise<BatchSummary> {
  const formData = new FormData();
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    formData.append("files", file);
  }

  const query = new URLSearchParams({
    crack_sensitivity: crackSensitivity.toFixed(2),
    stain_sensitivity: stainSensitivity.toFixed(2),
  });

  const res = await fetch(`/api/v1/inspect/batch?${query.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Batch inspection failed with status ${res.status}`);
  }

  return res.json();
}

export async function inspectTray(
  file: File,
  crackSensitivity = 0.5,
  stainSensitivity = 0.5
): Promise<TrayInspectionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const query = new URLSearchParams({
    crack_sensitivity: crackSensitivity.toFixed(2),
    stain_sensitivity: stainSensitivity.toFixed(2),
  });

  const res = await fetch(`/api/v1/inspect/tray?${query.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Tray inspection failed with status ${res.status}`);
  }

  return res.json();
}

export async function simulateConveyorFrame(
  traySize: "30" | "12" | "6" = "30",
  defectRate = 0.15,
  crackSensitivity = 0.5,
  stainSensitivity = 0.5
): Promise<TrayInspectionResult> {
  const query = new URLSearchParams({
    tray_size: traySize,
    defect_rate: defectRate.toFixed(2),
    crack_sensitivity: crackSensitivity.toFixed(2),
    stain_sensitivity: stainSensitivity.toFixed(2),
  });

  const res = await fetch(`/api/v1/conveyor/simulate-frame?${query.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Conveyor simulation failed with status ${res.status}`);
  }

  return res.json();
}

export async function fetchEnterpriseMetrics(): Promise<EnterpriseMetrics> {
  const res = await fetch("/api/v1/metrics");
  if (!res.ok) {
    throw new Error(`Failed to fetch metrics: ${res.status}`);
  }
  return res.json();
}

export async function fetchSampleImageFile(filename: string): Promise<File> {
  const res = await fetch(`/samples/${filename}`);
  if (!res.ok) {
    throw new Error(`Failed to load benchmark sample ${filename}`);
  }
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/jpeg" });
}
