import React, { useRef } from "react";
import { Layers, Upload, FileSpreadsheet } from "lucide-react";
import { BatchSummary } from "../lib/types";
import { exportBatchToCSV } from "../lib/utils";
import { GradeBadge } from "./GradeBadge";

interface BatchQCProps {
  batchResult: BatchSummary | null;
  isLoading: boolean;
  onUploadBatch: (files: FileList | null) => void;
}

export function BatchQC({ batchResult, isLoading, onUploadBatch }: BatchQCProps) {
  const batchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {/* Header and Action Buttons */}
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
              disabled={isLoading}
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
                onChange={(e) => onUploadBatch(e.target.files)}
              />
            </button>

            {batchResult && (
              <button
                onClick={() => exportBatchToCSV(batchResult)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Batch Yield Summary Cards */}
        {batchResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Total Inspected</div>
              <div className="text-2xl font-black text-white mt-1">
                {batchResult.total_inspected}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Batch Pass Rate</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {batchResult.pass_rate_percentage}%
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Grade A / B Yield</div>
              <div className="text-2xl font-black text-sky-400 mt-1">
                {batchResult.grade_a_count + batchResult.grade_b_count}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Rejects (Discard)</div>
              <div className="text-2xl font-black text-rose-400 mt-1">
                {batchResult.reject_count}
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300">
              Processing commercial egg batch inspection...
            </p>
          </div>
        )}

        {/* Itemized Batch Ledger */}
        {batchResult && (
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Itemized Batch Quality Ledger
            </h3>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item #</th>
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Commercial Grade</th>
                    <th className="py-3 px-4">Quality Score</th>
                    <th className="py-3 px-4">Detected Defects</th>
                    <th className="py-3 px-4">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {batchResult.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-white">
                        {item.filename || `Egg_${idx + 1}`}
                      </td>
                      <td className="py-3 px-4">
                        <GradeBadge grade={item.grade} size="sm" />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">
                        {item.quality_score}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.defects.length === 0 ? (
                          <span className="text-slate-500">None (Pristine)</span>
                        ) : (
                          item.defects.map((d) => d.defect_type).join(", ")
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.processing_time_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!batchResult && !isLoading && (
          <div className="py-16 text-center text-slate-500">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No Batch Loaded</p>
            <p className="text-xs text-slate-600 mt-1">
              Select multiple egg photos to run commercial batch grading
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
