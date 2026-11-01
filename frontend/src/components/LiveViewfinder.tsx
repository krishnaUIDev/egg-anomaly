"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { inspectSingleEgg } from "../lib/api";
import { InspectionResult } from "../lib/types";

interface SessionEggRecord {
  id: number;
  grade: string;
  score: number;
  isAcceptable: boolean;
  time: string;
  defectCount: number;
}

export function LiveViewfinder() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);
  const [currentResult, setCurrentResult] = useState<InspectionResult | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<"idle" | "searching" | "locked">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Live session statistics
  const [sessionRecords, setSessionRecords] = useState<SessionEggRecord[]>([]);
  const lastAnalyzedSignatureRef = useRef<string | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const continuousTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesize Web Audio chime or buzz without external audio files
  const playFeedbackSound = useCallback(
    (grade: string) => {
      if (!audioFeedback) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        if (grade === "Grade A" || grade === "Grade B") {
          // Melodic harmonic chime (D5 -> A5)
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.15);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else {
          // Low alert buzz for reject (180Hz)
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.setValueAtTime(150, now + 0.12);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        }
      } catch {
        // Audio autoplay policy or not supported
      }
    },
    [audioFeedback]
  );

  // Haptic vibration feedback for mobile devices
  const triggerHaptic = useCallback((grade: string) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (grade === "Reject") {
        navigator.vibrate([120, 60, 120]);
      } else {
        navigator.vibrate([70]);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setDetectionStatus("idle");
    if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setDetectionStatus("searching");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Camera access denied or unavailable: ${msg}. Check browser permissions.`);
    }
  };

  const captureFrameAndInspect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isInspecting) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setIsInspecting(true);
        try {
          const file = new File([blob], "live_frame.jpg", { type: "image/jpeg" });
          const res = await inspectSingleEgg(file, 0.5, 0.5);

          if (res.egg_detected) {
            setDetectionStatus("locked");
            setCurrentResult(res);

            // Deduplicate: avoid counting the exact same stationary egg repeatedly
            const signature = `${res.grade}-${res.quality_score.toFixed(1)}-${res.aspect_ratio}`;
            const now = Date.now();
            const isNewEgg =
              signature !== lastAnalyzedSignatureRef.current ||
              now - lastDetectionTimeRef.current > 4000;

            if (isNewEgg) {
              lastAnalyzedSignatureRef.current = signature;
              lastDetectionTimeRef.current = now;

              playFeedbackSound(res.grade);
              triggerHaptic(res.grade);

              const timeStr = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              setSessionRecords((prev) => [
                {
                  id: prev.length + 1,
                  grade: res.grade,
                  score: res.quality_score,
                  isAcceptable: res.is_acceptable,
                  time: timeStr,
                  defectCount: res.defects.length,
                },
                ...prev.slice(0, 24),
              ]);
            }
          } else {
            setDetectionStatus("searching");
          }
        } catch (err: unknown) {
          console.error("Frame inspection error", err);
        } finally {
          setIsInspecting(false);
        }
      },
      "image/jpeg",
      0.85
    );
  }, [isInspecting, playFeedbackSound, triggerHaptic]);

  // Handle continuous scanning interval (auto-scans every 1.1s)
  useEffect(() => {
    if (isContinuous && isStreaming) {
      continuousTimerRef.current = setInterval(() => {
        captureFrameAndInspect();
      }, 1100);
    } else if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
    return () => {
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    };
  }, [isContinuous, isStreaming, captureFrameAndInspect]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Session tallies
  const totalSessionEggs = sessionRecords.length;
  const gradeACount = sessionRecords.filter((r) => r.grade === "Grade A").length;
  const gradeBCount = sessionRecords.filter((r) => r.grade === "Grade B").length;
  const rejectCount = sessionRecords.filter((r) => r.grade === "Reject").length;
  const sessionPassRate =
    totalSessionEggs > 0
      ? (((gradeACount + gradeBCount) / totalSessionEggs) * 100).toFixed(1)
      : "--";

  return (
    <div className="viewfinder-container">
      {/* Top Header Card */}
      <section className="card">
        <div className="section-header-row">
          <div className="section-title-group">
            <h2>📹 Real-time Continuous Viewfinder</h2>
            <p className="section-desc">
              Hands-free continuous quality detection — hold camera over eggs to automatically
              classify and grade.
            </p>
          </div>

          <div className="action-buttons-inline">
            {!isStreaming ? (
              <button type="button" className="btn btn-primary" onClick={startCamera}>
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
                <span>Launch Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn ${isContinuous ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setIsContinuous(!isContinuous)}
                >
                  <span className={`status-dot ${isContinuous ? "pulse" : ""}`} />
                  <span>{isContinuous ? "Continuous Auto-Scan ON" : "Enable Auto-Scan"}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={captureFrameAndInspect}
                  disabled={isInspecting}
                >
                  <span>{isInspecting ? "Inspecting..." : "Snap Frame"}</span>
                </button>

                <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                  <span>Stop</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAudioFeedback(!audioFeedback)}
              title="Toggle audio feedback"
            >
              <span>{audioFeedback ? "🔊 Audio On" : "🔇 Audio Muted"}</span>
            </button>

            {sessionRecords.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSessionRecords([])}
                title="Reset session counters"
              >
                <span>Reset Tally</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Session Counter Bar */}
        {isStreaming && (
          <div className="tray-metrics-bar" style={{ marginTop: "0.25rem" }}>
            <div className="tray-metric-pill">
              <span className="tray-metric-num">{totalSessionEggs}</span>
              <span className="tray-metric-lbl">Eggs Scanned</span>
            </div>
            <div className="tray-metric-pill grade-a">
              <span className="tray-metric-num">{gradeACount}</span>
              <span className="tray-metric-lbl">Grade A</span>
            </div>
            <div className="tray-metric-pill grade-b">
              <span className="tray-metric-num">{gradeBCount}</span>
              <span className="tray-metric-lbl">Grade B</span>
            </div>
            <div className="tray-metric-pill grade-reject">
              <span className="tray-metric-num">{rejectCount}</span>
              <span className="tray-metric-lbl">Reject</span>
            </div>
            <div className="tray-metric-pill pass-rate">
              <span className="tray-metric-num">{sessionPassRate}%</span>
              <span className="tray-metric-lbl">Session Pass Rate</span>
            </div>
          </div>
        )}

        {errorMsg && <div className="error-alert">{errorMsg}</div>}
      </section>

      {/* Viewfinder Video HUD Screen */}
      <div className="viewfinder-viewport-wrapper">
        <div className="card viewfinder-stage-card">
          <div className="viewfinder-viewport">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`viewfinder-video ${isStreaming ? "active" : ""}`}
            />

            {/* Hidden canvas for real-time frame capture */}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!isStreaming && (
              <div className="empty-placeholder viewfinder-idle">
                <div className="placeholder-icon">📷</div>
                <h3>Camera Stream Idle</h3>
                <p>
                  Click &quot;Launch Camera&quot; to begin continuous real-time scanning with
                  automatic egg detection.
                </p>
              </div>
            )}

            {/* HUD Reticle Overlay */}
            {isStreaming && (
              <div className="hud-overlay">
                <div
                  className={`hud-reticle ${detectionStatus === "locked" ? "locked" : "searching"}`}
                >
                  <div className="hud-egg-silhouette" />
                  <div className="hud-corner top-left" />
                  <div className="hud-corner top-right" />
                  <div className="hud-corner bottom-left" />
                  <div className="hud-corner bottom-right" />
                  <div className="hud-crosshair-h" />
                  <div className="hud-crosshair-v" />
                </div>

                <div className={`hud-instruction ${detectionStatus === "locked" ? "locked" : ""}`}>
                  {isInspecting
                    ? "⚡ Analyzing shell..."
                    : detectionStatus === "locked"
                      ? "🎯 Egg Locked"
                      : "🔍 Aim reticle at egg"}
                </div>

                {/* Live Inspection Result Pill Overlay */}
                {currentResult && detectionStatus === "locked" && (
                  <div
                    className={`hud-result-pill ${
                      currentResult.grade === "Reject"
                        ? "reject"
                        : currentResult.grade === "Grade B"
                          ? "grade-b"
                          : "grade-a"
                    }`}
                  >
                    <span className="hud-result-badge">{currentResult.grade}</span>
                    <span className="hud-result-score">{currentResult.quality_score} / 100</span>
                    <span className="hud-result-latency">{currentResult.processing_time_ms}ms</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filmstrip of Recent Scans in This Session */}
          {sessionRecords.length > 0 && (
            <div className="viewfinder-filmstrip">
              <span className="filmstrip-label">Session Stream:</span>
              <div className="filmstrip-scroll">
                {sessionRecords.map((egg) => (
                  <div
                    key={egg.id}
                    className={`filmstrip-item ${
                      egg.grade === "Reject"
                        ? "reject"
                        : egg.grade === "Grade B"
                          ? "grade-b"
                          : "grade-a"
                    }`}
                  >
                    <span className="filmstrip-id">#{egg.id}</span>
                    <span className="filmstrip-grade">
                      {egg.grade === "Reject" ? "REJ" : egg.grade.replace("Grade ", "")}
                    </span>
                    <span className="filmstrip-score">{egg.score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Telemetry Sidebar */}
        <div className="card viewfinder-telemetry-card">
          <div className="section-title-group">
            <h3>Live Telemetry & Diagnostics</h3>
            <p className="section-desc">Continuous frame diagnostics and detected anomalies.</p>
          </div>

          {currentResult && (
            <>
              <div className="telemetry-stat-row">
                <span className="telemetry-label">Commercial Grade:</span>
                <span
                  className={`grade-tag ${
                    currentResult.grade === "Reject"
                      ? "reject"
                      : currentResult.grade === "Grade B"
                        ? "grade-b"
                        : "grade-a"
                  }`}
                >
                  {currentResult.grade}
                </span>
              </div>
              <div className="telemetry-stat-row">
                <span className="telemetry-label">Quality Score:</span>
                <span className="telemetry-val">{currentResult.quality_score} / 100</span>
              </div>
              <div className="telemetry-stat-row">
                <span className="telemetry-label">Classification:</span>
                <span className="telemetry-val">
                  {currentResult.is_acceptable ? "Marketable" : "Discard"}
                </span>
              </div>
              <div className="telemetry-stat-row">
                <span className="telemetry-label">Egg Geometry:</span>
                <span className="telemetry-val">
                  AR {currentResult.aspect_ratio} • Sol {currentResult.solidity}
                </span>
              </div>
              <div className="telemetry-stat-row">
                <span className="telemetry-label">Inference Latency:</span>
                <span className="telemetry-val">{currentResult.processing_time_ms} ms</span>
              </div>

              <p className="recommendation-text mt-3">{currentResult.recommendation}</p>

              <div className="defects-container mt-3">
                <h5>Localized Defect Log ({currentResult.defects.length})</h5>
                {currentResult.defects.length === 0 ? (
                  <p className="clean-egg-msg">
                    ✨ Shell intact. No structural cracks or contamination.
                  </p>
                ) : (
                  <div className="defects-list">
                    {currentResult.defects.map((d, i) => (
                      <div key={i} className={`defect-item ${d.defect_type}`}>
                        <div>
                          <div className="defect-title">{d.defect_type.replace(/_/g, " ")}</div>
                          <div className="defect-desc">{d.description}</div>
                        </div>
                        <div className="defect-badge">{(d.confidence * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!currentResult && (
            <div className="empty-placeholder" style={{ margin: "auto 0" }}>
              <p>Awaiting egg lock in camera reticle...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
