import React from "react";
import { Camera, Layers, BarChart3 } from "lucide-react";
import { ActiveTab } from "../lib/types";
import { cn } from "../lib/utils";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  systemHealthy: boolean;
}

export function Header({ activeTab, onTabChange, systemHealthy }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
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
                Monorepo v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI Anomaly Detection & USDA Quality Control System
            </p>
          </div>
        </div>

        {/* Mode Navigation */}
        <nav
          className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-lg"
          aria-label="Dashboard views"
        >
          <button
            onClick={() => onTabChange("single")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all",
              activeTab === "single"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
            aria-pressed={activeTab === "single"}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Inspection Studio</span>
          </button>
          <button
            onClick={() => onTabChange("batch")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all",
              activeTab === "batch"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
            aria-pressed={activeTab === "batch"}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tray Batch QC</span>
          </button>
          <button
            onClick={() => onTabChange("analytics")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all",
              activeTab === "analytics"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
            aria-pressed={activeTab === "analytics"}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Telemetry & SLA</span>
          </button>
        </nav>

        {/* SLA Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              systemHealthy
                ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                : "bg-rose-500"
            )}
          />
          <span className="text-slate-300">
            {systemHealthy ? "Inference Active (<50ms)" : "Backend Disconnected"}
          </span>
        </div>
      </div>
    </header>
  );
}

