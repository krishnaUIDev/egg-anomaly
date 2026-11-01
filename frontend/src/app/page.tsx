"use client";

import React, { useState, useRef } from "react";
import { inspectSingleEgg } from "../lib/api";
import { InspectionResult, ViewLayer } from "../lib/types";
import { ThemeToggle } from "../components/ThemeToggle";

export default function EggScanApp() {
  const [activeTab, setActiveTab] = useState<ViewLayer>("annotated");
  const [crackSensitivity, setCrackSensitivity] = useState(0.5);
  const [stainSensitivity, setStainSensitivity] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [rawPreview, setRawPreview] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setRawPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    await executeInspection(file);
  }

  async function executeInspection(file: File) {
    setIsLoading(true);
    try {
      const data = await inspectSingleEgg(file, crackSensitivity, stainSensitivity);
      setResult(data);
      setActiveTab("annotated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Inspection failed: " + msg);
    } finally {
      setIsLoading(false);
    }
  }

  // Determine current image to render based on active tab
  let currentImageSrc: string | null = null;
  if (result) {
    if (activeTab === "annotated") {
      currentImageSrc = result.annotated_image_data || rawPreview || null;
    } else if (activeTab === "heatmap") {
      currentImageSrc = result.heatmap_data || result.annotated_image_data || rawPreview || null;
    } else {
      currentImageSrc = rawPreview || result.annotated_image_data || null;
    }
  }

  // Grade banner styling class
  let gradeClass = "grade-a";
  if (result) {
    if (result.grade === "Reject") {
      gradeClass = "grade-reject";
    } else if (result.grade === "Grade B") {
      gradeClass = "grade-b";
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-area">
          <div className="logo-icon">🥚</div>
          <div>
            <h1>EggScan AI</h1>
            <p className="subtitle">Real-time Anomaly Detection & Quality Grading</p>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <div className="status-indicator" id="statusPill">
            <span className={`status-dot ${isLoading ? "pulse" : ""}`} />
            <span id="statusText">{isLoading ? "Analyzing..." : "System Ready"}</span>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="main-layout">
        {/* Left: Capture & Controls Card */}
        <section className="card capture-card">
          <h2>Capture Egg</h2>
          <p className="section-desc">
            Snap a photo with your phone camera or upload an image to begin real-time analysis.
          </p>

          {/* Capture Buttons */}
          <div className="action-buttons">
            <label className="btn btn-primary" htmlFor="cameraInput">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Take Phone Photo</span>
              <input
                ref={cameraInputRef}
                type="file"
                id="cameraInput"
                accept="image/*"
                capture="environment"
                className="file-input"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </label>

            <label className="btn btn-secondary" htmlFor="fileInput">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload Image</span>
              <input
                ref={fileInputRef}
                type="file"
                id="fileInput"
                accept="image/*"
                className="file-input"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* Sensitivity Controls Accordion */}
          <details className="sensitivity-accordion" open>
            <summary>⚙️ Detection Tuning & Sensitivity</summary>
            <div className="slider-group">
              <div className="slider-row">
                <label htmlFor="crackSensitivity">
                  Crack Detection Sensitivity: <span>{crackSensitivity.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  id="crackSensitivity"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={crackSensitivity}
                  onChange={(e) => setCrackSensitivity(parseFloat(e.target.value))}
                />
              </div>
              <div className="slider-row">
                <label htmlFor="stainSensitivity">
                  Stain & Dirt Sensitivity: <span>{stainSensitivity.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  id="stainSensitivity"
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

        {/* Right: Inspection Results View */}
        <section className="card results-card" id="resultsSection">
          <div className="results-header">
            <h2>Inspection Output</h2>
            <div className="meta-tags" id="metaTags">
              <span className="tag" id="latencyTag">
                {result ? `${result.processing_time_ms} ms` : "-- ms"}
              </span>
              <span className="tag" id="detectionTag">
                {result
                  ? `Egg ROI: ${(result.detection_confidence * 100).toFixed(0)}%`
                  : "Egg ROI: --"}
              </span>
            </div>
          </div>

          {/* View Tabs */}
          <div className="view-tabs" role="tablist">
            <button
              className={`tab-btn ${activeTab === "annotated" ? "active" : ""}`}
              onClick={() => setActiveTab("annotated")}
              role="tab"
              aria-selected={activeTab === "annotated"}
            >
              Annotated Detection
            </button>
            <button
              className={`tab-btn ${activeTab === "heatmap" ? "active" : ""}`}
              onClick={() => setActiveTab("heatmap")}
              role="tab"
              aria-selected={activeTab === "heatmap"}
            >
              Anomaly Heatmap
            </button>
            <button
              className={`tab-btn ${activeTab === "original" ? "active" : ""}`}
              onClick={() => setActiveTab("original")}
              role="tab"
              aria-selected={activeTab === "original"}
            >
              Original Photo
            </button>
          </div>

          {/* Image Display Area */}
          <div className="preview-stage" id="previewStage">
            {!currentImageSrc && !isLoading && (
              <div className="empty-placeholder" id="emptyPlaceholder">
                <div className="placeholder-icon">📸</div>
                <p>Take a phone photo or upload an image to view inspection analysis</p>
              </div>
            )}

            {currentImageSrc && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                id="displayImage"
                src={currentImageSrc}
                alt="Egg inspection display"
                className="preview-img"
              />
            )}

            {isLoading && (
              <div className="spinner-overlay" id="spinnerOverlay">
                <div className="spinner" />
                <p>Analyzing egg shell structure & defects...</p>
              </div>
            )}
          </div>

          {/* Grade Banner & Score */}
          {result && (
            <div className={`grade-banner ${gradeClass}`} id="gradeBanner">
              <div className="grade-badge" id="gradeBadge">
                {result.grade}
              </div>
              <div className="grade-info">
                <div className="grade-score-row">
                  <span className="quality-label">Quality Score:</span>
                  <span className="quality-score-value" id="qualityScoreVal">
                    {result.quality_score} / 100
                  </span>
                </div>
                <p className="recommendation-text" id="recommendationText">
                  {result.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Defects List */}
          {result && result.defects && result.defects.length > 0 && (
            <div className="defects-container" id="defectsContainer">
              <h3>Detected Defects & Anomalies</h3>
              <div className="defects-list" id="defectsList">
                {result.defects.map((defect, idx) => (
                  <div key={idx} className={`defect-item ${defect.defect_type}`}>
                    <div>
                      <div className="defect-title">{defect.defect_type.replace(/_/g, " ")}</div>
                      <div className="defect-desc">{defect.description}</div>
                    </div>
                    <div className="defect-badge">{(defect.confidence * 100).toFixed(0)}% conf</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log Summary */}
          {result && result.reasons && result.reasons.length > 0 && (
            <div className="audit-summary" id="auditSummary">
              <h4>Inspection Audit Trail:</h4>
              <ul id="auditReasons">
                {result.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>EggScan AI • Dual-Engine Phone Camera Inspection • USDA Commercial Quality Standards</p>
      </footer>
    </div>
  );
}
