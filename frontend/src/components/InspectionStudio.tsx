import React, { useRef } from "react";
import { Camera, Upload, Sparkles } from "lucide-react";
import { InspectionResult, ViewLayer } from "../lib/types";
import { SAMPLE_EGGS, USDA_DIRECTIVES } from "../lib/constants";
import { DiagnosticCanvas } from "./DiagnosticCanvas";
import { SensitivityControls } from "./SensitivityControls";
import { GradeBadge } from "./GradeBadge";

interface InspectionStudioProps {
  result: InspectionResult | null;
  rawPreview: string | null;
  viewLayer: ViewLayer;
  onLayerChange: (layer: ViewLayer) => void;
  isLoading: boolean;
  onSelectFile: (file: File) => void;
  onSelectSample: (filename: string) => void;
  crackSensitivity: number;
  stainSensitivity: number;
  onCrackChange: (val: number) => void;
  onStainChange: (val: number) => void;
}

export function InspectionStudio({
  result,
  rawPreview,
  viewLayer,
  onLayerChange,
  isLoading,
  onSelectFile,
  onSelectSample,
  crackSensitivity,
  stainSensitivity,
  onCrackChange,
  onStainChange,
}: InspectionStudioProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Control Card */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-400" /> Image Capture & Ingestion
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Trigger native smartphone camera directly or upload an inspection capture.
          </p>

          {/* Action Buttons */}
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
                onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
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
                onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
              />
            </button>
          </div>

          {/* Quick Benchmark Chips */}
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
                  onClick={() => onSelectSample(sample.id)}
                  disabled={isLoading}
                  className={`text-left p-2 rounded-lg border text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${sample.badgeClass}`}
                >
                  <div className="font-semibold truncate">{sample.label}</div>
                  <div className="text-[9px] opacity-75">{sample.expected}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity Calibration */}
          <SensitivityControls
            crackSensitivity={crackSensitivity}
            stainSensitivity={stainSensitivity}
            onCrackChange={onCrackChange}
            onStainChange={onStainChange}
          />
        </div>

        {/* USDA Sorting Standards Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
          <h3 className="font-bold text-slate-300">USDA Egg Sorting Directives:</h3>
          <ul className="space-y-1.5 text-slate-400 text-[11px]">
            {USDA_DIRECTIVES.map((d) => (
              <li key={d.grade} className="flex items-start gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${d.color}`} />
                <span>
                  <strong className="text-slate-300">{d.grade}:</strong> {d.desc}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right Canvas & Results Card */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
          <DiagnosticCanvas
            result={result}
            rawPreview={rawPreview}
            viewLayer={viewLayer}
            onLayerChange={onLayerChange}
            isLoading={isLoading}
          />

          {/* Grading Output Banner */}
          {result && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between mb-4 ${
                result.grade === "Grade A"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : result.grade === "Grade B"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <GradeBadge grade={result.grade} size="lg" />
                  {result.is_acceptable ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                      Market Fit
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase">
                      Discard
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90 mt-1">{result.recommendation}</p>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-75 font-medium">Quality Score</div>
                <div className="text-2xl font-black font-mono">{result.quality_score}</div>
              </div>
            </div>
          )}

          {/* Detected Defects List */}
          {result && result.defects.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Detected Shell Defects ({result.defects.length})
              </h3>
              <div className="space-y-1.5">
                {result.defects.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold uppercase text-slate-200">
                        {d.defect_type.replace("_", " ")}
                      </span>
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

          {/* Audit Verification Trail */}
          {result && result.reasons.length > 0 && (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
              <span className="font-semibold text-slate-400 block mb-1">
                Audit Verification Trail:
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                {result.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

