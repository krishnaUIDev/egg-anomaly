import React from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { EnterpriseMetrics } from "../lib/types";

interface AnalyticsDashboardProps {
  metrics: EnterpriseMetrics | null;
  onRefresh: () => void;
}

export function AnalyticsDashboard({ metrics, onRefresh }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-400" /> Enterprise QC Analytics & Telemetry
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time throughput, SLA adherence, and defect distributions.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Total Inspected */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Lifetime Inspections</span>
              <div className="text-3xl font-black text-white mt-1">{metrics.total_inspections}</div>
              <div className="text-[11px] text-slate-500 mt-2">Active Engine: {metrics.active_engine}</div>
            </div>

            {/* Pass Rate */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Commercial Pass Rate</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">
                {metrics.pass_rate_percentage}%
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Target SLA: &gt; 92.0%</div>
            </div>

            {/* Engine Uptime */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Microservice Uptime</span>
              <div className="text-3xl font-black text-sky-400 mt-1">
                {metrics.uptime_seconds.toFixed(0)}s
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Kubernetes Pod Health: Optimal</div>
            </div>
          </div>
        )}

        {/* Grade Distribution Bars */}
        {metrics && (
          <div className="mt-8 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Quality Grade Distributions
            </h3>
            <div className="space-y-3">
              {Object.entries(metrics.grade_distribution).map(([grade, count]) => {
                const total = metrics.total_inspections || 1;
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <div key={grade} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-300">{grade}</span>
                      <span className="font-mono text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          grade === "Grade A"
                            ? "bg-emerald-500"
                            : grade === "Grade B"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
