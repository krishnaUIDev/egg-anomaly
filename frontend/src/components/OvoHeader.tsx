"use client";

import React from "react";
import { SlidersHorizontal, FileDown } from "lucide-react";

interface OvoHeaderProps {
  fps: number;
  lotNumber: string;
  onOpenCOA: () => void;
}

export function OvoHeader({ fps, lotNumber, onOpenCOA }: OvoHeaderProps) {
  return (
    <header className="border-b border-slate-700 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/40 text-xl font-black text-slate-950">
          🥚
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base sm:text-lg">
              OvoGrade<span className="text-emerald-500">AI</span>
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
              USDA 7 CFR §56 Compliant
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Automated Mobile Computer Vision & Real-time Candling Anomaly System
          </p>
        </div>
      </div>

      {/* Live Status Pill & Global Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-slate-300 text-[11px]">FPS: {fps.toFixed(1)}</span>
        </div>

        <button
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all flex items-center gap-1.5 text-xs"
          title="Active Lot Identifier"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{lotNumber}</span>
        </button>

        <button
          onClick={onOpenCOA}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white shadow-md shadow-emerald-900/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>COA Report</span>
        </button>
      </div>
    </header>
  );
}
