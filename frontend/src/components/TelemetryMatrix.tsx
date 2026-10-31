import React from "react";
import { Crosshair } from "lucide-react";
import { OvoEggScenario } from "../lib/types";

interface TelemetryMatrixProps {
  currentEgg: OvoEggScenario;
}

export function TelemetryMatrix({ currentEgg }: TelemetryMatrixProps) {
  const crackPct = Math.min(100, currentEgg.crackSeverity * 100);
  const bloodPct = currentEgg.bloodSpotDetected ? 95 : 2;
  const dirtPct = Math.min(100, currentEgg.dirtPercentage * 10);
  const lossPct =
    currentEgg.grade.includes("Loss") || currentEgg.grade.includes("Inedible") ? 100 : 0;

  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-500" />
          <h4 className="text-xs font-bold tracking-wide uppercase text-slate-200">
            Active Defect Telemetry & Feature Vectors
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-400">12 Model Heads Parallelized</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {/* 1. Hairline / Micro-checks */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Shell Cracks (Checks)</span>
            <span
              className={`font-mono font-semibold ${currentEgg.cracksDetected ? "text-rose-400" : "text-emerald-400"}`}
            >
              {(currentEgg.crackSeverity * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentEgg.cracksDetected ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(2, crackPct)}%` }}
            />
          </div>
          <span
            className={`mt-1 text-[9px] font-mono font-bold ${currentEgg.cracksDetected ? "text-rose-400" : "text-emerald-400"}`}
          >
            {currentEgg.cracksDetected ? "CHECK DETECTED (REJECT)" : "STATUS: SOUND SHELL"}
          </span>
        </div>

        {/* 2. Blood & Meat Spots (Internal) */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Blood / Meat Spots</span>
            <span
              className={`font-mono font-semibold ${currentEgg.bloodSpotDetected ? "text-rose-400" : "text-emerald-400"}`}
            >
              {currentEgg.bloodSpotMm.toFixed(1)} mm
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentEgg.bloodSpotDetected ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${bloodPct}%` }}
            />
          </div>
          <span
            className={`mt-1 text-[9px] font-mono font-bold ${currentEgg.bloodSpotDetected ? "text-rose-400" : "text-emerald-400"}`}
          >
            {currentEgg.bloodSpotDetected ? 'BLOOD DEFECT > 1/8" (LOSS)' : "STATUS: CLEAR INTERIOR"}
          </span>
        </div>

        {/* 3. Stains & Dirt Area % */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Foreign Stains (Dirt)</span>
            <span
              className={`font-mono font-semibold ${currentEgg.dirtPercentage > 1 ? "text-amber-400" : "text-emerald-400"}`}
            >
              {currentEgg.dirtPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentEgg.dirtPercentage > 3 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${dirtPct}%` }}
            />
          </div>
          <span
            className={`mt-1 text-[9px] font-mono font-bold ${currentEgg.dirtPercentage > 3 ? "text-amber-400" : "text-emerald-400"}`}
          >
            {currentEgg.dirtPercentage > 3 ? "STAIN > 1/16 (DOWNGRADE)" : "AREA ≤ 1/32 (CLEAN)"}
          </span>
        </div>

        {/* 4. Yolk Mobility & Shadow */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Yolk Mobility & Shadow</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {currentEgg.yolkCentering.split(",")[0]}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "22%" }} />
          </div>
          <span className="mt-1 text-[9px] font-mono text-emerald-400">AA: INDISTINCT CONTOUR</span>
        </div>

        {/* 5. Egg Sizing / Gram Estimation via Aspect */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Weight Est. (Mass CV)</span>
            <span className="font-mono text-amber-400 font-semibold">
              {currentEgg.weightGrams.toFixed(1)} g
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: "68%" }} />
          </div>
          <span className="mt-1 text-[9px] font-mono text-slate-300">SIZE: LARGE (24 oz/doz)</span>
        </div>

        {/* 6. Leaker / Shell Rupture Critical Loss */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Leaker / Loss Risk</span>
            <span
              className={`font-mono font-semibold ${lossPct > 0 ? "text-rose-400" : "text-emerald-400"}`}
            >
              {lossPct > 0 ? "99.1%" : "0.00%"}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                lossPct > 0 ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${lossPct > 0 ? 100 : 0}%` }}
            />
          </div>
          <span
            className={`mt-1 text-[9px] font-mono font-bold ${lossPct > 0 ? "text-rose-400" : "text-emerald-400"}`}
          >
            {lossPct > 0 ? "CRITICAL RUPTURE (DISCARD)" : "PASSED COMMERCIAL CRITERIA"}
          </span>
        </div>
      </div>
    </div>
  );
}
