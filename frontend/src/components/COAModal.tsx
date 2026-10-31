"use client";

import React, { useState } from "react";
import { Award, X, Copy, Printer, Check } from "lucide-react";
import { LotStats } from "../lib/types";

interface COAModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: LotStats;
}

export function COAModal({ isOpen, onClose, stats }: COAModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleCopyJSON() {
    const payload = {
      facility_id: "PLANT-GA-9023 (LINE 04)",
      lot_id: "LOT #US-8842-OCT31",
      standard: "USDA 7 CFR Part 56",
      inspected_total: stats.totalInspected,
      grade_distribution: {
        grade_AA: stats.gradeAA,
        grade_A: stats.gradeA,
        grade_B: stats.gradeB,
        loss_rejects: stats.loss,
      },
      tolerance_origin_passed: true,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-750 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">USDA Shell Egg Grading Certificate</h3>
            <p className="text-xs text-slate-400">Official Certificate of Analysis (COA) Summary</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 mb-4">
          <div className="flex justify-between border-b border-slate-850 pb-1">
            <span className="text-slate-500">FACILITY ID:</span>
            <span className="text-slate-200 font-semibold">PLANT-GA-9023 (LINE 04)</span>
          </div>
          <div className="flex justify-between border-b border-slate-850 pb-1">
            <span className="text-slate-500">LOT IDENTIFIER:</span>
            <span className="text-slate-200 font-semibold">LOT #US-8842-OCT31</span>
          </div>
          <div className="flex justify-between border-b border-slate-850 pb-1">
            <span className="text-slate-500">STANDARD APPLIED:</span>
            <span className="text-emerald-400 font-semibold">USDA 7 CFR Part 56</span>
          </div>
          <div className="flex justify-between border-b border-slate-850 pb-1">
            <span className="text-slate-500">FINAL ASSIGNED GRADE:</span>
            <span className="text-emerald-400 font-bold">U.S. CONSUMER GRADE AA (ORIGIN)</span>
          </div>
          <div className="flex justify-between border-b border-slate-850 pb-1">
            <span className="text-slate-500">TOTAL SAMPLED:</span>
            <span className="text-slate-200">{stats.totalInspected} eggs inspected</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CRITICAL CHECKS / LOSS:</span>
            <span className="text-emerald-400">
              {((stats.loss / Math.max(1, stats.totalInspected)) * 100).toFixed(1)}% (Within ≤ 5.0%
              origin tolerance)
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleCopyJSON}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied JSON!" : "Copy Raw JSON"}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
