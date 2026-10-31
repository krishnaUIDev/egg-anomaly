"use client";

import React from "react";
import { Lightbulb, Flashlight, RefreshCw, Camera } from "lucide-react";

interface QuickControlsProps {
  candlingActive: boolean;
  torchActive: boolean;
  activeSampleName: string;
  onToggleCandling: () => void;
  onToggleTorch: () => void;
  onCycleAnomaly: () => void;
  onCaptureSKU: () => void;
  isInspecting: boolean;
}

export function QuickControls({
  candlingActive,
  torchActive,
  activeSampleName,
  onToggleCandling,
  onToggleTorch,
  onCycleAnomaly,
  onCaptureSKU,
  isInspecting,
}: QuickControlsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {/* Candling Backlight Toggle */}
      <button
        onClick={onToggleCandling}
        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 flex flex-col items-start justify-between transition-all group text-left cursor-pointer active:scale-95"
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-[11px] font-medium text-slate-400 group-hover:text-amber-400 transition">
            Transillumination
          </span>
          <Lightbulb className={`w-4 h-4 transition-colors ${candlingActive ? "text-amber-400 fill-amber-400" : "text-slate-400"}`} />
        </div>
        <div className={`text-xs font-bold ${candlingActive ? "text-amber-400" : "text-slate-200"}`}>
          {candlingActive ? "Candling: ON (5500K)" : "Candling: OFF"}
        </div>
        <span className="text-[10px] text-slate-500 mt-0.5">High-lumen torch backlighting</span>
      </button>

      {/* Device Torch */}
      <button
        onClick={onToggleTorch}
        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500/50 flex flex-col items-start justify-between transition-all group text-left cursor-pointer active:scale-95"
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition">
            Device Torch
          </span>
          <Flashlight className={`w-4 h-4 transition-colors ${torchActive ? "text-emerald-400 fill-emerald-400" : "text-slate-400"}`} />
        </div>
        <div className={`text-xs font-bold ${torchActive ? "text-emerald-400" : "text-slate-200"}`}>
          {torchActive ? "Torch: ON (100%)" : "Torch: OFF"}
        </div>
        <span className="text-[10px] text-slate-500 mt-0.5">Hardware flash sync</span>
      </button>

      {/* Cycle / Inject Anomaly */}
      <button
        onClick={onCycleAnomaly}
        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-purple-500/50 flex flex-col items-start justify-between transition-all group text-left cursor-pointer active:scale-95"
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-[11px] font-medium text-slate-400 group-hover:text-purple-400 transition">
            Inject Anomaly
          </span>
          <RefreshCw className="w-4 h-4 text-purple-400 group-hover:rotate-180 transition-transform duration-300" />
        </div>
        <div className="text-xs font-bold text-slate-200 truncate w-full">
          {activeSampleName}
        </div>
        <span className="text-[10px] text-slate-500 mt-0.5">Hairline, Blood, Stain, Leaker</span>
      </button>

      {/* Capture SKU */}
      <button
        onClick={onCaptureSKU}
        disabled={isInspecting}
        className="p-2.5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-750 border border-slate-700 hover:border-emerald-500/50 flex flex-col items-start justify-between transition-all group text-left cursor-pointer active:scale-95 shadow-md shadow-emerald-900/10"
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition">
            Inspect & Log
          </span>
          <Camera className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xs font-bold text-emerald-400">
          {isInspecting ? "Processing..." : "Capture SKU"}
        </div>
        <span className="text-[10px] text-slate-500 mt-0.5">Store audit trail entry</span>
      </button>
    </div>
  );
}
