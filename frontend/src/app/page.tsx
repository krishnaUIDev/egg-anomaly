"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  Layers,
  Settings,
  Sparkles,
  Download,
  Activity,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";

interface DefectItem {
  defect_type: string;
  confidence: number;
  severity: string;
  bbox: number[];
  area_ratio: number;
  description: string;
}

interface InspectionResult {
  filename?: string;
  egg_detected: boolean;
  detection_confidence: number;
  grade: string;
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

interface BatchSummary {
  total_inspected: number;
  grade_a_count: number;
  grade_b_count: number;
  reject_count: number;
  pass_rate_percentage: number;
  defect_breakdown: Record<string, number>;
  total_processing_time_ms: number;
  items: InspectionResult[];
}

interface EnterpriseMetrics {
  total_inspections: number;
  pass_rate_percentage: number;
  grade_distribution: Record<string, number>;
  defect_frequencies: Record<string, number>;
  uptime_seconds: number;
  active_engine: string;
}

const SAMPLE_EGGS = [
  { id: "clean_brown.jpg", label: "Clean Brown", expected: "Grade A", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  { id: "clean_white.jpg", label: "Clean White", expected: "Grade A", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  { id: "dirt_stain.jpg", label: "Dirt Stain", expected: "Grade B", color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  { id: "deformed_egg.jpg", label: "Deformed Shell", expected: "Grade B", color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
  { id: "crack_fissure.jpg", label: "Crack Fissure", expected: "Reject", color: "bg-rose-500/10 border-rose-500/30 text-rose-400" },
  { id: "blood_spot.jpg", label: "Blood Spot", expected: "Reject", color: "bg-rose-500/10 border-rose-500/30 text-rose-400" },
];

export default function EggScanDashboard() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "analytics">("single");

  // Single Inspection State
  const [singleResult, setSingleResult] = useState<InspectionResult | null>(null);
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"annotated" | "heatmap" | "original">("annotated");
  const [isInspecting, setIsInspecting] = useState(false);

  // Tuning Parameters
  const [crackSensitivity, setCrackSensitivity] = useState(0.5);
  const [stainSensitivity, setStainSensitivity] = useState(0.5);

  // Batch State
  const [batchResult, setBatchResult] = useState<BatchSummary | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Enterprise Metrics
  const [metrics, setMetrics] = useState<EnterpriseMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<boolean>(true);

  // Inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/v1/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setSystemHealth(true);
      }
    } catch {
      setSystemHealth(false);
    }
  }

  // Handle Single Image Upload
  async function handleSingleFile(file: File) {
    if (!file) return;
    setIsInspecting(true);

    const reader = new FileReader();
    reader.onload = (e) => setRawPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `/api/v1/inspect?crack_sensitivity=${crackSensitivity}&stain_sensitivity=${stainSensitivity}`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error("Inspection failed");
      const data: InspectionResult = await res.json();
      setSingleResult(data);
      setViewMode("annotated");
      fetchMetrics();
    } catch (err: any) {
      alert("Error inspecting egg: " + err.message);
    } finally {
      setIsInspecting(false);
    }
  }

  // Test Sample
  async function testSample(filename: string) {
    setIsInspecting(true);
    try {
      const res = await fetch(`/samples/${filename}`);
      if (!res.ok) throw new Error("Failed to load sample");
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      await handleSingleFile(file);
    } catch (err: any) {
      alert("Sample error: " + err.message);
      setIsInspecting(false);
    }
  }

  // Handle Batch File Upload
  async function handleBatchFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsBatchLoading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(
        `/api/v1/inspect/batch?crack_sensitivity=${crackSensitivity}&stain_sensitivity=${stainSensitivity}`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error("Batch inspection failed");
      const data: BatchSummary = await res.json();
      setBatchResult(data);
      fetchMetrics();
    } catch (err: any) {
      alert("Batch inspection error: " + err.message);
    } finally {
      setIsBatchLoading(false);
    }
  }

  // Export Batch CSV
  function exportBatchCSV() {
    if (!batchResult) return;
    const headers = ["Filename", "Grade", "Quality Score", "Acceptable", "Defects Count", "Defect Types", "Processing Time (ms)"];
    const rows = batchResult.items.map((item, idx) => [
      item.filename || `Egg_${idx + 1}`,
      item.grade,
      item.quality_score,
      item.is_acceptable ? "YES" : "NO",
      item.defects.length,
      `"${item.defects.map((d) => d.defect_type).join("; ")}"`,
      item.processing_time_ms,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eggscan_qc_batch_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper for grade styling
  function getGradeBadge(grade: string) {
    if (grade === "Grade A") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> Grade A
        </span>
      );
    }
    if (grade === "Grade B") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> Grade B
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" /> Reject
      </span>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Enterprise Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-sky-500/20">
              🥚
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  EggScan Enterprise
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 uppercase tracking-widest">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">AI Anomaly Detection & USDA Quality Control System</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("single")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "single" ? "bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Inspection Studio</span>
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "batch" ? "bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tray Batch QC</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "analytics" ? "bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Telemetry & SLA</span>
            </button>
          </nav>

          {/* SLA Status Indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
            <span className={`w-2 h-2 rounded-full ${systemHealth ? "bg-emerald-500 shadow-sm shadow-emerald-500" : "bg-rose-500"}`} />
            <span className="text-slate-300">{systemHealth ? "Inference Active (<50ms)" : "Engine Disconnected"}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: SINGLE EGG INSPECTION STUDIO */}
        {activeTab === "single" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Control Card */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Capture Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-sky-400" /> Image Capture & Ingestion
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Trigger native smartphone camera directly or upload an inspection capture.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                  >
                    <Camera className="w-6 h-6" />
                    <span>Phone Camera</span>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleSingleFile(e.target.files[0])}
                    />
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-all active:scale-[0.98]"
                  >
                    <Upload className="w-6 h-6 text-slate-300" />
                    <span>Upload File</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleSingleFile(e.target.files[0])}
                    />
                  </button>
                </div>

                {/* Benchmark Samples Gallery */}
                <div className="border-t border-slate-800/80 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Benchmark Test Samples:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SAMPLE_EGGS.map((sample) => (
                      <button
                        key={sample.id}
                        onClick={() => testSample(sample.id)}
                        disabled={isInspecting}
                        className={`text-left p-2 rounded-lg border text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${sample.color}`}
                      >
                        <div className="font-semibold truncate">{sample.label}</div>
                        <div className="text-[9px] opacity-75">{sample.expected}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Model Parameter Tuning */}
                <div className="border-t border-slate-800/80 pt-4 mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-3">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-400" /> Defect Sensitivity Calibration
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Crack Sensitivity:</span>
                        <span className="font-mono text-sky-400 font-bold">{crackSensitivity.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={crackSensitivity}
                        onChange={(e) => setCrackSensitivity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Stain & Dirt Sensitivity:</span>
                        <span className="font-mono text-sky-400 font-bold">{stainSensitivity.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={stainSensitivity}
                        onChange={(e) => setStainSensitivity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Standards Reference */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
                <h3 className="font-bold text-slate-300">USDA Egg Sorting Directives:</h3>
                <ul className="space-y-1 text-slate-400 text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <strong>Grade A/AA:</strong> Shell unbroken, clean, practically normal shape.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <strong>Grade B:</strong> Unbroken, slight stains (&lt;3% surface), slight deformities.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <strong>Reject:</strong> Cracks, leaks, blood spots, or heavy contamination.
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Results & Studio Canvas */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-sky-400" />
                    <h2 className="text-base font-bold text-white">Inspection Canvas & Diagnostic Layers</h2>
                  </div>

                  {singleResult && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                        ⏱️ {singleResult.processing_time_ms} ms
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        ROI: {(singleResult.detection_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Layer Switching Tabs */}
                {singleResult && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setViewMode("annotated")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        viewMode === "annotated"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Annotated Bounding Boxes
                    </button>
                    <button
                      onClick={() => setViewMode("heatmap")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        viewMode === "heatmap"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Anomaly Heatmap
                    </button>
                    <button
                      onClick={() => setViewMode("original")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        viewMode === "original"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Original Camera Capture
                    </button>
                  </div>
                )}

                {/* Display Canvas Stage */}
                <div className="relative w-full aspect-square max-h-[420px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center mb-5">
                  {isInspecting && (
                    <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
                      <p className="text-xs font-medium text-slate-300">Analyzing shell integrity & anomalies...</p>
                    </div>
                  )}

                  {!singleResult && !rawPreview && (
                    <div className="text-center p-6 text-slate-500">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">Ready for Inspection</p>
                      <p className="text-xs text-slate-600 mt-1">Take a phone photo or click a benchmark sample</p>
                    </div>
                  )}

                  {singleResult && (
                    <img
                      src={
                        viewMode === "annotated"
                          ? singleResult.annotated_image_data || rawPreview || ""
                          : viewMode === "heatmap"
                          ? singleResult.heatmap_data || rawPreview || ""
                          : rawPreview || ""
                      }
                      alt="Egg Inspection Analysis"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Grading Output Banner */}
                {singleResult && (
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between mb-4 ${
                      singleResult.grade === "Grade A"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : singleResult.grade === "Grade B"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-black tracking-tight">{singleResult.grade}</span>
                        {singleResult.is_acceptable ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                            Market Fit
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase">
                            Discard
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-90">{singleResult.recommendation}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-75 font-medium">Quality Score</div>
                      <div className="text-2xl font-black font-mono">{singleResult.quality_score}</div>
                    </div>
                  </div>
                )}

                {/* Defects Table */}
                {singleResult && singleResult.defects.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Detected Defects</h3>
                    <div className="space-y-1.5">
                      {singleResult.defects.map((d, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold uppercase text-slate-200">{d.defect_type.replace("_", " ")}</span>
                            <p className="text-[11px] text-slate-400">{d.description}</p>
                          </div>
                          <div className="text-right font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                              {(d.confidence * 100).toFixed(0)}% Conf
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Trail Reasons */}
                {singleResult && singleResult.reasons.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                    <span className="font-semibold text-slate-400 block mb-1">Audit Verification Trail:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                      {singleResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BATCH / TRAY QC MODE */}
        {activeTab === "batch" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-sky-400" /> Commercial Tray Batch Inspection
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload multiple egg photos simultaneously for high-throughput commercial sorting and quality control auditing.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => batchInputRef.current?.click()}
                    disabled={isBatchLoading}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Batch (up to 50)</span>
                    <input
                      ref={batchInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBatchFiles(e.target.files)}
                    />
                  </button>

                  {batchResult && (
                    <button
                      onClick={exportBatchCSV}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Export CSV Report</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Batch Summary Stats Cards */}
              {batchResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Total Inspected</div>
                    <div className="text-2xl font-black text-white mt-1">{batchResult.total_inspected}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Batch Pass Rate</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{batchResult.pass_rate_percentage}%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Grade A / B Yield</div>
                    <div className="text-2xl font-black text-sky-400 mt-1">
                      {batchResult.grade_a_count + batchResult.grade_b_count}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Rejects (Discard)</div>
                    <div className="text-2xl font-black text-rose-400 mt-1">{batchResult.reject_count}</div>
                  </div>
                </div>
              )}

              {/* Batch Loading Spinner */}
              {isBatchLoading && (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-300">Processing commercial egg batch...</p>
                </div>
              )}

              {/* Batch Grid Results */}
              {batchResult && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Itemized Batch Ledger</h3>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Item #</th>
                          <th className="py-3 px-4">Filename</th>
                          <th className="py-3 px-4">Commercial Grade</th>
                          <th className="py-3 px-4">Quality Score</th>
                          <th className="py-3 px-4">Defects</th>
                          <th className="py-3 px-4">Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {batchResult.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4 font-medium text-white">{item.filename || `Egg_${idx + 1}`}</td>
                            <td className="py-3 px-4">{getGradeBadge(item.grade)}</td>
                            <td className="py-3 px-4 font-mono font-bold">{item.quality_score}</td>
                            <td className="py-3 px-4 text-slate-300">
                              {item.defects.length === 0 ? (
                                <span className="text-slate-500">None (Pristine)</span>
                              ) : (
                                item.defects.map((d) => d.defect_type).join(", ")
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">{item.processing_time_ms} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!batchResult && !isBatchLoading && (
                <div className="py-16 text-center text-slate-500">
                  <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No Batch Loaded</p>
                  <p className="text-xs text-slate-600 mt-1">Select multiple egg photos to run commercial batch grading</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ENTERPRISE ANALYTICS & TELEMETRY */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-sky-400" /> Enterprise QC Analytics & Telemetry
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Real-time throughput, SLA adherence, and defect distributions.</p>
                </div>
                <button
                  onClick={fetchMetrics}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  {/* Total Inspected */}
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">Lifetime Inspections</span>
                    <div className="text-3xl font-black text-white mt-1">{metrics.total_inspections}</div>
                    <div className="text-[11px] text-slate-500 mt-2">Active Engine: {metrics.active_engine}</div>
                  </div>

                  {/* Pass Rate */}
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">Commercial Pass Rate</span>
                    <div className="text-3xl font-black text-emerald-400 mt-1">{metrics.pass_rate_percentage}%</div>
                    <div className="text-[11px] text-slate-500 mt-2">Target SLA: &gt; 92.0%</div>
                  </div>

                  {/* Engine Uptime */}
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">System Uptime</span>
                    <div className="text-3xl font-black text-sky-400 mt-1">{metrics.uptime_seconds.toFixed(0)}s</div>
                    <div className="text-[11px] text-slate-500 mt-2">Microservice Health: Optimal</div>
                  </div>
                </div>
              )}

              {/* Grade Distribution Bars */}
              {metrics && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quality Grade Distributions</h3>
                  <div className="space-y-3">
                    {Object.entries(metrics.grade_distribution).map(([grade, count]) => {
                      const total = metrics.total_inspections || 1;
                      const pct = ((count / total) * 100).toFixed(1);
                      return (
                        <div key={grade} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-300">{grade}</span>
                            <span className="font-mono text-slate-400">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                grade === "Grade A" ? "bg-emerald-500" : grade === "Grade B" ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Enterprise Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 text-xs py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 EggScan Enterprise Inc. Automated Computer Vision & Commercial Sorting.</p>
        <div className="flex items-center gap-4 text-[11px]">
          <span>REST API: v2.0.0</span>
          <span>OpenAPI 3.1</span>
          <span>Docker & Kubernetes Ready</span>
        </div>
      </footer>
    </div>
  );
}
