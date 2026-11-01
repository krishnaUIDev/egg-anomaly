"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { inspectSingleEgg } from "../lib/api";
import { InspectionResult } from "../lib/types";

export function LiveViewfinder() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [currentResult, setCurrentResult] = useState<InspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioFeedback, setAudioFeedback] = useState(true);

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
          // High harmonic chime
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else {
          // Low double buzz for reject
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

  // Haptic vibration feedback
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
    setIsContinuous(false);
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
          setCurrentResult(res);
          playFeedbackSound(res.grade);
          triggerHaptic(res.grade);
        } catch (err: unknown) {
          console.error("Frame inspection error", err);
        } finally {
          setIsInspecting(false);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [isInspecting, playFeedbackSound, triggerHaptic]);

  // Handle continuous scanning interval
  useEffect(() => {
    if (isContinuous && isStreaming) {
      continuousTimerRef.current = setInterval(() => {
        captureFrameAndInspect();
      }, 1400);
    } else if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
    return () => {
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    };
  }, [isContinuous, isStreaming, captureFrameAndInspect]);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="viewfinder-container">
      {/* Top Controls Bar */}
      <section className="card">
        <div className="section-header-row">
          <div>
            <h2>📹 Real-time Viewfinder HUD</h2>
            <p className="section-desc">
              Hands-free continuous quality scanning for conveyor belts and packing lines.
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
                  <span>{isContinuous ? "Auto-Scanning Active" : "Enable Auto-Scan"}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
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
              title="Toggle audio chimes"
            >
              <span>{audioFeedback ? "🔊 Audio On" : "🔇 Audio Muted"}</span>
            </button>
          </div>
        </div>

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

            {/* Hidden canvas for frame extraction */}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!isStreaming && (
              <div className="empty-placeholder viewfinder-idle">
                <div className="placeholder-icon">📷</div>
                <h3>Camera Stream Idle</h3>
                <p>
                  Click &quot;Launch Camera&quot; to activate your phone back camera or laptop
                  webcam
                </p>
              </div>
            )}

            {/* HUD Reticle Overlay */}
            {isStreaming && (
              <div className="hud-overlay">
                {/* Crosshairs & Oval Reticle */}
                <div className="hud-reticle">
                  <div className="hud-egg-silhouette" />
                  <div className="hud-corner top-left" />
                  <div className="hud-corner top-right" />
                  <div className="hud-corner bottom-left" />
                  <div className="hud-corner bottom-right" />
                  <div className="hud-crosshair-h" />
                  <div className="hud-crosshair-v" />
                </div>

                <div className="hud-instruction">Center egg in crosshairs</div>

                {/* Live Inspection Result Pill Overlay */}
                {currentResult && (
                  <div
                    className={`hud-result-pill ${currentResult.grade === "Reject" ? "reject" : currentResult.grade === "Grade B" ? "grade-b" : "grade-a"}`}
                  >
                    <span className="hud-result-badge">{currentResult.grade}</span>
                    <span className="hud-result-score">{currentResult.quality_score}/100</span>
                    <span className="hud-result-latency">{currentResult.processing_time_ms}ms</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Sidebar */}
        {currentResult && (
          <div className="card viewfinder-telemetry-card">
            <h3>Live Frame Telemetry</h3>
            <div className="telemetry-stat-row">
              <span className="telemetry-label">Commercial Grade:</span>
              <span
                className={`grade-tag ${currentResult.grade === "Reject" ? "reject" : currentResult.grade === "Grade B" ? "grade-b" : "grade-a"}`}
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
              <span className="telemetry-label">Defects Found:</span>
              <span className="telemetry-val">{currentResult.defects.length}</span>
            </div>
            <div className="telemetry-stat-row">
              <span className="telemetry-label">Inference Latency:</span>
              <span className="telemetry-val">{currentResult.processing_time_ms} ms</span>
            </div>

            <p className="recommendation-text mt-3">{currentResult.recommendation}</p>

            {currentResult.defects.length > 0 && (
              <div className="defects-container mt-3">
                <h5>Localized Defect Log</h5>
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
