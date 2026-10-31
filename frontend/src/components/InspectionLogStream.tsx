import React from "react";
import { ListFilter } from "lucide-react";
import { LogEntry } from "../lib/types";

interface InspectionLogStreamProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function InspectionLogStream({ logs, onClear }: InspectionLogStreamProps) {
  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-emerald-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Real-time Inspection Stream
          </h4>
        </div>
        <button
          onClick={onClear}
          className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          Clear Logs
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1 text-xs no-scrollbar font-mono">
        {logs.map((log) => {
          const isAA = log.grade === "AA";
          const isLoss = log.grade.includes("Loss") || log.grade.includes("Inedible") || log.grade.includes("Reject");
          const badgeColor = isAA ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-amber-400";

          return (
            <div
              key={log.id}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between animate-fadeIn"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-mono text-[10px]">{log.time}</span>
                <span className="text-slate-200 font-semibold">{log.sku}</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{log.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className={`font-bold text-[11px] ${badgeColor}`}>[{log.grade}]</span>
                <span className="text-[10px] text-slate-400">{log.weight}</span>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            No inspection transactions logged yet. Click "Capture SKU" to record.
          </div>
        )}
      </div>
    </div>
  );
}
