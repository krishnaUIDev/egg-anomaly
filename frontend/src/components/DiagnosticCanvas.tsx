import React from "react";
import { Camera, Eye } from "lucide-react";
import { InspectionResult, ViewLayer } from "../lib/types";
import { cn } from "../lib/utils";

interface DiagnosticCanvasProps {
  result: InspectionResult | null;
  rawPreview: string | null;
  viewLayer: ViewLayer;
  onLayerChange: (layer: ViewLayer) => void;
  isLoading: boolean;
}

export function DiagnosticCanvas({
  result,
  rawPreview,
  viewLayer,
  onLayerChange,
  isLoading,
}: DiagnosticCanvasProps) {
  const currentImageSrc =
    viewLayer === "annotated"
      ? result?.annotated_image_data || rawPreview
      : viewLayer === "heatmap"
      ? result?.heatmap_data || rawPreview
      : rawPreview || result?.annotated_image_data;

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white">Inspection Canvas & Diagnostic Layers</h2>
        </div>

        {result && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
              ⏱️ {result.processing_time_ms} ms
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              ROI: {(result.detection_confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Layer Toggle Tabs */}
      {result && (
        <div className="flex gap-2 mb-4" role="tablist">
          <button
            onClick={() => onLayerChange("annotated")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              viewLayer === "annotated"
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-white"
            )}
            role="tab"
            aria-selected={viewLayer === "annotated"}
          >
            Annotated Bounding Boxes
          </button>
          <button
            onClick={() => onLayerChange("heatmap")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              viewLayer === "heatmap"
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-white"
            )}
            role="tab"
            aria-selected={viewLayer === "heatmap"}
          >
            Anomaly Heatmap
          </button>
          <button
            onClick={() => onLayerChange("original")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              viewLayer === "original"
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-white"
            )}
            role="tab"
            aria-selected={viewLayer === "original"}
          >
            Original Camera Capture
          </button>
        </div>
      )}

      {/* Canvas Box */}
      <div className="relative w-full aspect-square max-h-[420px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center mb-5">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-300">Analyzing shell integrity & anomalies...</p>
          </div>
        )}

        {!result && !rawPreview && (
          <div className="text-center p-6 text-slate-500">
            <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Ready for Inspection</p>
            <p className="text-xs text-slate-600 mt-1">Take a phone photo or pick a benchmark sample</p>
          </div>
        )}

        {currentImageSrc && (
          <img
            src={currentImageSrc}
            alt="Egg Inspection Analysis Display"
            className="w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

