"use client";

import React, { useEffect, useRef } from "react";
import { PieChart } from "lucide-react";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";
import { LotStats } from "../lib/types";

// Register Chart.js components
Chart.register(DoughnutController, ArcElement, Tooltip);

interface LotDistributionCardProps {
  stats: LotStats;
}

export function LotDistributionCard({ stats }: LotDistributionCardProps) {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Grade AA", "Grade A", "Grade B", "Reject/Loss"],
        datasets: [
          {
            data: [stats.gradeAA, stats.gradeA, stats.gradeB, stats.loss],
            backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
            borderColor: "#111827",
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.raw as number;
                const total = stats.totalInspected || 1;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: ${val} (${pct}%)`;
              },
            },
          },
        },
        cutout: "72%",
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [stats]);

  const total = Math.max(stats.totalInspected, 1);
  const aaPct = ((stats.gradeAA / total) * 100).toFixed(1);
  const aPct = ((stats.gradeA / total) * 100).toFixed(1);
  const bPct = ((stats.gradeB / total) * 100).toFixed(1);
  const lossPct = ((stats.loss / total) * 100).toFixed(1);

  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Production Lot Grade Distribution
          </h4>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 font-semibold">
          Lot Total: {stats.totalInspected} Units
        </span>
      </div>

      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-5 h-36 relative flex items-center justify-center">
          <canvas ref={chartCanvasRef} />
        </div>
        <div className="col-span-7 flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Grade AA:
            </span>
            <span className="font-bold text-white">
              {stats.gradeAA} ({aaPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Grade A:
            </span>
            <span className="font-bold text-white">
              {stats.gradeA} ({aPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Grade B:
            </span>
            <span className="font-bold text-white">
              {stats.gradeB} ({bPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Reject / Loss:
            </span>
            <span className="font-bold text-rose-400">
              {stats.loss} ({lossPct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
