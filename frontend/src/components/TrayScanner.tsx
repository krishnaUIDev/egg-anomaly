"use client";

import React, { useState, useRef } from "react";
import { inspectTray } from "../lib/api";
import { TrayInspectionResult, TrayEggItem } from "../lib/types";

export function TrayScanner() {
  const [trayResult, setTrayResult] = useState<TrayInspectionResult | null>(null);
  const [selectedEgg, setSelectedEgg] = useState<TrayEggItem | null>(null);
  const [crackSensitivity, setCrackSensitivity] = useState(0.5);
  const [stainSensitivity, setStainSensitivity] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [rawPreview, setRawPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setRawPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsLoading(true);
    setSelectedEgg(null);
    try {
      const data = await inspectTray(file, crackSensitivity, stainSensitivity);
      setTrayResult(data);
      if (data.eggs.length > 0) {
        setSelectedEgg(data.eggs[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Tray inspection failed: " + msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="tray-scanner-container">
      {/* Top Banner / Actions Card */}
      <section className="card">
        <div className="section-header-row">
          <div>
            <h2>🗂️ Carton & Tray Batch Inspector</h2>
            <p className="section-desc">
              Scan whole 6/12-egg consumer cartons or 30-egg commercial packing flats in a single
              photo.
            </p>
          </div>

          <div className="action-buttons-inline">
            <label className="btn btn-primary" htmlFor="trayCameraInput">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Capture Tray</span>
              <input
                ref={cameraInputRef}
                type="file"
                id="trayCameraInput"
                accept="image/*"
                capture="environment"
                className="file-input"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </label>

            <label className="btn btn-secondary" htmlFor="trayFileInput">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload Tray Photo</span>
              <input
                ref={fileInputRef}
                type="file"
                id="trayFileInput"
                accept="image/*"
                className="file-input"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        {/* Sensitivity Tuning Accordion */}
        <details className="sensitivity-accordion">
          <summary>⚙️ Detection Sensitivity Controls</summary>
          <div className="slider-group">
            <div className="slider-row">
              <label htmlFor="trayCrackSens">
                Crack Detection Sensitivity: <span>{crackSensitivity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                id="trayCrackSens"
                min="0.1"
                max="1.0"
                step="0.05"
                value={crackSensitivity}
                onChange={(e) => setCrackSensitivity(parseFloat(e.target.value))}
              />
            </div>
            <div className="slider-row">
              <label htmlFor="trayStainSens">
                Stain Sensitivity: <span>{stainSensitivity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                id="trayStainSens"
                min="0.1"
                max="1.0"
                step="0.05"
                value={stainSensitivity}
                onChange={(e) => setStainSensitivity(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </details>
      </section>

      {/* Main Grid: Left = Tray Annotated View, Right = Individual Egg Grid & Inspector */}
      <div className="tray-layout-grid">
        {/* Left: Tray Stage */}
        <section className="card tray-stage-card">
          <div className="results-header">
            <h3>Tray Segmentation Map</h3>
            {trayResult && (
              <div className="meta-tags">
                <span className="tag">{trayResult.processing_time_ms} ms</span>
                <span className="tag">{trayResult.total_eggs_detected} Eggs Detected</span>
              </div>
            )}
          </div>

          <div className="preview-stage tray-preview-stage">
            {!trayResult && !isLoading && (
              <div className="empty-placeholder">
                <div className="placeholder-icon">🗂️</div>
                <p>
                  Upload or take a photo of an egg carton or tray to segment and grade every egg
                </p>
              </div>
            )}

            {trayResult && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={trayResult.annotated_tray_image || rawPreview || ""}
                alt="Carton inspection result"
                className="preview-img"
              />
            )}

            {isLoading && (
              <div className="spinner-overlay">
                <div className="spinner" />
                <p>Segmenting individual eggs & detecting micro-anomalies...</p>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          {trayResult && (
            <div className="tray-metrics-bar">
              <div className="tray-metric-pill">
                <span className="tray-metric-num">{trayResult.total_eggs_detected}</span>
                <span className="tray-metric-lbl">Total Eggs</span>
              </div>
              <div className="tray-metric-pill grade-a">
                <span className="tray-metric-num">{trayResult.grade_a_count}</span>
                <span className="tray-metric-lbl">Grade A</span>
              </div>
              <div className="tray-metric-pill grade-b">
                <span className="tray-metric-num">{trayResult.grade_b_count}</span>
                <span className="tray-metric-lbl">Grade B</span>
              </div>
              <div className="tray-metric-pill grade-reject">
                <span className="tray-metric-num">{trayResult.reject_count}</span>
                <span className="tray-metric-lbl">Rejects</span>
              </div>
              <div className="tray-metric-pill pass-rate">
                <span className="tray-metric-num">{trayResult.tray_pass_rate_percentage}%</span>
                <span className="tray-metric-lbl">Pass Rate</span>
              </div>
            </div>
          )}
        </section>

        {/* Right: Egg Grid & Detail Card */}
        <section className="card tray-detail-card">
          <h3>Individual Egg Quality Roster</h3>
          <p className="section-desc">
            Select an egg below to review its defect localization and quality audit.
          </p>

          {!trayResult && (
            <div className="empty-placeholder" style={{ margin: "auto 0" }}>
              <p>Awaiting tray scan...</p>
            </div>
          )}

          {trayResult && (
            <>
              {/* Egg Chips Grid */}
              <div className="egg-chips-grid">
                {trayResult.eggs.map((egg) => {
                  let badgeColorClass = "badge-a";
                  if (egg.grade === "Reject") badgeColorClass = "badge-reject";
                  else if (egg.grade === "Grade B") badgeColorClass = "badge-b";

                  const isSelected = selectedEgg?.egg_id === egg.egg_id;

                  return (
                    <button
                      key={egg.egg_id}
                      type="button"
                      className={`egg-cell-btn ${badgeColorClass} ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedEgg(egg)}
                    >
                      <span className="egg-cell-num">#{egg.egg_id}</span>
                      <span className="egg-cell-grade">
                        {egg.grade === "Reject" ? "REJ" : egg.grade.replace("Grade ", "")}
                      </span>
                      <span className="egg-cell-score">{egg.quality_score.toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Egg Inspection Details */}
              {selectedEgg && (
                <div className="selected-egg-panel">
                  <div className="selected-egg-header">
                    <h4>Egg #{selectedEgg.egg_id} Inspection Report</h4>
                    <span
                      className={`grade-tag ${selectedEgg.grade === "Reject" ? "reject" : selectedEgg.grade === "Grade B" ? "grade-b" : "grade-a"}`}
                    >
                      {selectedEgg.grade}
                    </span>
                  </div>

                  <div className="grade-score-row">
                    <span className="quality-label">Quality Score:</span>
                    <span className="quality-score-value">{selectedEgg.quality_score} / 100</span>
                    <span className="quality-label" style={{ marginLeft: "auto" }}>
                      {selectedEgg.is_acceptable ? "✅ Marketable" : "❌ Discard"}
                    </span>
                  </div>

                  <p className="recommendation-text">{selectedEgg.recommendation}</p>

                  <div className="defects-container">
                    <h5>Defects Localized ({selectedEgg.defect_count})</h5>
                    {selectedEgg.defects.length === 0 ? (
                      <p className="clean-egg-msg">
                        ✨ Pristine shell with no detected fissures or stains.
                      </p>
                    ) : (
                      <div className="defects-list">
                        {selectedEgg.defects.map((d, i) => (
                          <div key={i} className={`defect-item ${d.defect_type}`}>
                            <div>
                              <div className="defect-title">{d.defect_type.replace(/_/g, " ")}</div>
                              <div className="defect-desc">{d.description}</div>
                            </div>
                            <div className="defect-badge">
                              {(d.confidence * 100).toFixed(0)}% conf
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
