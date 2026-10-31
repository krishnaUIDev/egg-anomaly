import React from "react";
import { OvoEggScenario } from "../lib/types";

interface GradeDecisionCardProps {
  currentEgg: OvoEggScenario;
}

export function GradeDecisionCard({ currentEgg }: GradeDecisionCardProps) {
  const isLoss = currentEgg.grade.includes("Loss") || currentEgg.grade.includes("Inedible");

  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-750/60">
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
            Official Classification
          </span>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>U.S. Consumer Grade {currentEgg.grade}</span>
          </h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          {/* USDA Shield Graphic */}
          <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z" />
          </svg>
        </div>
      </div>

      {/* Metric comparison breakdown */}
      <div className="grid grid-cols-3 gap-2 my-3 text-center">
        <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Air Cell Depth</span>
          <span
            className={`text-xs font-mono font-bold ${currentEgg.airCellMm <= 3.2 ? "text-emerald-400" : "text-amber-400"}`}
          >
            {currentEgg.airCellInch} ({currentEgg.grade})
          </span>
        </div>
        <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block">White & Yolk</span>
          <span className="text-xs font-mono font-bold text-emerald-400 truncate block">
            {currentEgg.yolkCentering.split(",")[0]}
          </span>
        </div>
        <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Shell Condition</span>
          <span
            className={`text-xs font-mono font-bold truncate block ${currentEgg.cracksDetected ? "text-rose-400" : "text-emerald-400"}`}
          >
            {currentEgg.cracksDetected ? "Check Fissure" : "Clean / Sound"}
          </span>
        </div>
      </div>

      {/* Grade Tolerance Origin vs Destination Alert */}
      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-slate-200">Origin Batch Tolerance:</span>
          <span className={`font-mono font-bold ${isLoss ? "text-rose-400" : "text-emerald-400"}`}>
            {isLoss ? "NON-COMPLIANT (EXCEEDS LOSS TOLERANCE)" : "100% IN COMPLIANCE"}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Grade AA at Origin requires min. 87% AA quality; max 13% A or B combined, max 5% Checks,
          max 0.50% Dirties/Leakers/Loss.
        </p>
      </div>
    </div>
  );
}
