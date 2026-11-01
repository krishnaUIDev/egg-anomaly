"use client";

import React, { useState, useEffect } from "react";
import { fetchEnterpriseMetrics } from "../lib/api";
import { EnterpriseMetrics } from "../lib/types";

export function AnalyticsView() {
  const [metrics, setMetrics] = useState<EnterpriseMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadMetrics() {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEnterpriseMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Failed to load plant telemetry: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetchEnterpriseMetrics()
      .then((data) => {
        if (!ignore) {
          setMetrics(data);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMsg(`Failed to load plant telemetry: ${msg}`);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  function handleExportCSV() {
    if (!metrics) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Inspections", metrics.total_inspections.toString()],
      ["Commercial Pass Rate (%)", metrics.pass_rate_percentage.toString()],
      ["Active Inspection Engine", metrics.active_engine],
      ["Uptime (seconds)", metrics.uptime_seconds.toFixed(0)],
      ...Object.entries(metrics.grade_distribution).map(([grade, count]) => [
        `Grade - ${grade}`,
        count.toString(),
      ]),
      ...Object.entries(metrics.defect_frequencies).map(([defect, count]) => [
        `Defect - ${defect}`,
        count.toString(),
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `eggscan_plant_qc_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="analytics-view-container">
      {/* Top Header Card */}
      <section className="card">
        <div className="section-header-row">
          <div className="section-title-group">
            <h2>📊 Enterprise Plant QC & Real-Time Analytics</h2>
            <p className="section-desc">
              Continuous yield monitoring, USDA commercial grading compliance, and defect telemetry.
            </p>
          </div>

          <div className="action-buttons-inline">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadMetrics}
              disabled={isLoading}
            >
              <span>{isLoading ? "Refreshing..." : "🔄 Refresh"}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportCSV}
              disabled={!metrics}
            >
              <span>📥 Export CSV Report</span>
            </button>
          </div>
        </div>

        {errorMsg && <div className="error-alert">{errorMsg}</div>}

        {metrics && (
          <div className="analytics-metrics-grid">
            <div className="metric-box">
              <span className="metric-box-title">Total Inspected</span>
              <div className="metric-box-val">{metrics.total_inspections}</div>
              <span className="metric-box-sub">Across all camera nodes</span>
            </div>

            <div className="metric-box">
              <span className="metric-box-title">Commercial Pass Rate</span>
              <div className="metric-box-val accent-green">{metrics.pass_rate_percentage}%</div>
              <span className="metric-box-sub">Target SLA: &gt; 92.0%</span>
            </div>

            <div className="metric-box">
              <span className="metric-box-title">Active AI Engine</span>
              <div className="metric-box-val accent-blue" style={{ fontSize: "1.25rem" }}>
                {metrics.active_engine}
              </div>
              <span className="metric-box-sub">Uptime: {metrics.uptime_seconds.toFixed(0)}s</span>
            </div>
          </div>
        )}
      </section>

      {/* Grade and Defect Breakdown Cards */}
      {metrics && (
        <div className="analytics-breakdown-grid">
          {/* Grade Distribution Card */}
          <section className="card">
            <div className="section-title-group">
              <h3>USDA Commercial Grade Distribution</h3>
              <p className="section-desc">Breakdown of marketable vs reject classifications.</p>
            </div>

            <div className="progress-bars-list">
              {Object.entries(metrics.grade_distribution).map(([grade, count]) => {
                const total = metrics.total_inspections || 1;
                const pct = ((count / total) * 100).toFixed(1);

                let fillClass = "fill-grade-a";
                if (grade === "Reject") fillClass = "fill-reject";
                else if (grade === "Grade B") fillClass = "fill-grade-b";

                return (
                  <div key={grade} className="progress-item">
                    <div className="progress-header">
                      <span className="progress-label">{grade}</span>
                      <span className="progress-stats">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Defect Frequency Card */}
          <section className="card">
            <div className="section-title-group">
              <h3>Defect Classification Frequency</h3>
              <p className="section-desc">Identified defect taxonomy across inspected lots.</p>
            </div>

            <div className="progress-bars-list">
              {Object.entries(metrics.defect_frequencies).map(([defect, count]) => {
                const total = metrics.total_inspections || 1;
                const pct = ((count / total) * 100).toFixed(1);

                return (
                  <div key={defect} className="progress-item">
                    <div className="progress-header">
                      <span className="progress-label">{defect.replace(/_/g, " ")}</span>
                      <span className="progress-stats">{count} occurrences</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill fill-accent-blue"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
