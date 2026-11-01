"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { inspectTray, simulateConveyorFrame, fetchIndustrialCameraFrame } from "../lib/api";
import { TrayInspectionResult, TrayEggItem, PlcActuatorSignal } from "../lib/types";

interface PlcLogMessage {
  id: string;
  timestamp: string;
  source: "PLC" | "CAM" | "AI" | "ACTUATOR";
  text: string;
  type: "info" | "trigger" | "reject" | "pass";
}

type ConveyorSourceMode = "camera" | "industrial" | "virtual";

export function ConveyorSimulator() {
  const [sourceMode, setSourceMode] = useState<ConveyorSourceMode>("camera");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isContinuousScanning, setIsContinuousScanning] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [scanIntervalMs, setScanIntervalMs] = useState(300); // ~3.3 FPS continuous scan
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Industrial RTSP/Network Camera states
  const [industrialStreamUrl, setIndustrialStreamUrl] = useState("0");
  const [isIndustrialActive, setIsIndustrialActive] = useState(false);

  // Virtual mode states
  const [isVirtualRunning, setIsVirtualRunning] = useState(false);
  const [traySize, setTraySize] = useState<"30" | "12" | "6">("30");
  const [defectRate, setDefectRate] = useState(0.15);
  const [beltSpeedEggsPerHr, setBeltSpeedEggsPerHr] = useState(1800);
  const [strobeEnabled, setStrobeEnabled] = useState(true);
  const [beltPosition, setBeltPosition] = useState(0); // 0 to 100%
  const [beltPhase, setBeltPhase] = useState<"infeed" | "inspecting" | "diverting" | "clear">(
    "clear"
  );
  const [sensorTripped, setSensorTripped] = useState(false);
  const [strobeFlashed, setStrobeFlashed] = useState(false);

  // Shared inspection telemetry & live states
  const [trayResult, setTrayResult] = useState<TrayInspectionResult | null>(null);
  const [selectedEgg, setSelectedEgg] = useState<TrayEggItem | null>(null);
  const [activeSolenoids, setActiveSolenoids] = useState<number[]>([]);
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const [lastInferenceTimeMs, setLastInferenceTimeMs] = useState(0);
  const [encoderPulses, setEncoderPulses] = useState(14820);
  const [activeDivertAlert, setActiveDivertAlert] = useState<string | null>(null);

  // Cumulative session statistics
  const [sessionTotalEggs, setSessionTotalEggs] = useState(0);
  const [sessionGradeA, setSessionGradeA] = useState(0);
  const [sessionGradeB, setSessionGradeB] = useState(0);
  const [sessionCracksDiverted, setSessionCracksDiverted] = useState(0);
  const [sessionStainsDiverted, setSessionStainsDiverted] = useState(0);
  const [sessionBloodDiverted, setSessionBloodDiverted] = useState(0);
  const [logs, setLogs] = useState<PlcLogMessage[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraLoopRef = useRef<NodeJS.Timeout | null>(null);
  const industrialLoopRef = useRef<NodeJS.Timeout | null>(null);
  const virtualLoopRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const isVirtualRunningRef = useRef(isVirtualRunning);
  useEffect(() => {
    isVirtualRunningRef.current = isVirtualRunning;
  }, [isVirtualRunning]);

  const isContinuousScanningRef = useRef(isContinuousScanning);
  useEffect(() => {
    isContinuousScanningRef.current = isContinuousScanning;
  }, [isContinuousScanning]);

  const isCameraActiveRef = useRef(isCameraActive);
  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  const isIndustrialActiveRef = useRef(isIndustrialActive);
  useEffect(() => {
    isIndustrialActiveRef.current = isIndustrialActive;
  }, [isIndustrialActive]);

  // Audio feedback synthesis (Web Audio API)
  const playFeedbackSound = useCallback(
    (hasReject: boolean) => {
      if (!audioFeedback) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        if (!hasReject) {
          // Melodic passing chime
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        } else {
          // Alert buzzer for crack/reject
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.setValueAtTime(140, now + 0.15);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        }
      } catch {
        // Audio policy or unsupported
      }
    },
    [audioFeedback]
  );

  // Mobile haptic feedback
  const triggerHaptic = useCallback((hasReject: boolean) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (hasReject) {
        navigator.vibrate([120, 60, 120]);
      } else {
        navigator.vibrate([50]);
      }
    }
  }, []);

  const addLog = useCallback(
    (source: PlcLogMessage["source"], text: string, type: PlcLogMessage["type"]) => {
      const now = new Date();
      const timeStr = `${now.toTimeString().split(" ")[0]}.${String(now.getMilliseconds()).padStart(3, "0")}`;
      setLogs((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: timeStr,
          source,
          text,
          type,
        },
      ]);
    },
    []
  );

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Render bounding boxes & badges on live overlay canvas
  const drawOverlaysOnCanvas = useCallback(
    (result: TrayInspectionResult, width: number, height: number) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      result.eggs.forEach((egg) => {
        const [x, y, w, h] = egg.bbox;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;

        let strokeColor = "#10b981"; // Grade A
        let fillColor = "rgba(16, 185, 129, 0.12)";
        let badgeBg = "#10b981";

        if (egg.grade === "Reject") {
          strokeColor = "#ef4444";
          fillColor = "rgba(239, 68, 68, 0.22)";
          badgeBg = "#ef4444";
        } else if (egg.grade === "Grade B") {
          strokeColor = "#f59e0b";
          fillColor = "rgba(245, 158, 11, 0.15)";
          badgeBg = "#f59e0b";
        }

        // Draw egg ellipse / ring
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.lineWidth = egg.grade === "Reject" ? 3.5 : 2.5;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // Draw defect markers if present
        egg.defects.forEach((defect) => {
          const [dx, dy, dw, dh] = defect.bbox;
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + dx, y + dy, dw, dh);
        });

        // Draw pocket badge
        const badgeText = `${egg.pocket_label || `#${egg.egg_id}`} ${egg.grade === "Grade A" ? "A" : egg.grade === "Grade B" ? "B" : "REJ"}`;
        ctx.font = "bold 13px ui-monospace, SFMono-Regular, monospace";
        const textWidth = ctx.measureText(badgeText).width;
        const badgeX = Math.max(x, 6);
        const badgeY = Math.max(y - 8, 18);

        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.roundRect(badgeX - 4, badgeY - 14, textWidth + 8, 18, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(badgeText, badgeX, badgeY);
      });
    },
    []
  );

  // Ingest inspection result into session telemetry
  const ingestResult = useCallback(
    (result: TrayInspectionResult) => {
      setTrayResult(result);
      setLastInferenceTimeMs(result.processing_time_ms);
      setEncoderPulses((p) => p + result.total_eggs_detected * 8);

      setSessionTotalEggs((t) => t + result.total_eggs_detected);
      setSessionGradeA((a) => a + result.grade_a_count);
      setSessionGradeB((b) => b + result.grade_b_count);

      const cracks = result.eggs.filter((e) =>
        e.defects.some((d) => d.defect_type === "crack")
      ).length;
      const stains = result.eggs.filter((e) =>
        e.defects.some((d) => d.defect_type === "dirt_stain")
      ).length;
      const blood = result.eggs.filter((e) =>
        e.defects.some((d) => d.defect_type === "blood_spot")
      ).length;

      setSessionCracksDiverted((c) => c + cracks);
      setSessionStainsDiverted((s) => s + stains);
      setSessionBloodDiverted((b) => b + blood);

      const hasReject = result.reject_count > 0;
      playFeedbackSound(hasReject);
      triggerHaptic(hasReject);

      if (hasReject && result.plc_signals && result.plc_signals.length > 0) {
        const firstSig = result.plc_signals[0];
        setActiveDivertAlert(
          `ACTUATOR SOLENOID #${firstSig.solenoid_valve_id} FIRED: ${firstSig.pocket_label} (${firstSig.primary_defect || "Reject"}) -> ${firstSig.target_chute}`
        );
        setTimeout(() => setActiveDivertAlert(null), 1800);

        const valves = result.plc_signals.map((s) => s.solenoid_valve_id);
        setActiveSolenoids(valves);
        setTimeout(() => setActiveSolenoids([]), 400);

        result.plc_signals.forEach((sig: PlcActuatorSignal) => {
          addLog(
            "ACTUATOR",
            `Solenoid #${sig.solenoid_valve_id} fired @ Pulse +${sig.encoder_pulse_offset}: Diverted ${sig.pocket_label} (${sig.primary_defect || "Reject"}) -> ${sig.target_chute}`,
            "reject"
          );
        });
      } else {
        addLog(
          "AI",
          `Frame scan: ${result.total_eggs_detected} eggs inspected in ${result.processing_time_ms}ms (Pass Rate: ${result.tray_pass_rate_percentage}%)`,
          "pass"
        );
      }
    },
    [addLog, playFeedbackSound, triggerHaptic]
  );

  // --- LIVE CAMERA CAPTURE CYCLE ---
  const captureCameraScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || isProcessingFrame) return;

    setIsProcessingFrame(true);
    try {
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      let offscreen = offscreenCanvasRef.current;
      if (!offscreen) {
        offscreen = document.createElement("canvas");
        offscreenCanvasRef.current = offscreen;
      }
      if (offscreen.width !== vWidth || offscreen.height !== vHeight) {
        offscreen.width = vWidth;
        offscreen.height = vHeight;
      }

      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, vWidth, vHeight);

      offscreen.toBlob(
        async (blob) => {
          if (!blob) {
            setIsProcessingFrame(false);
            return;
          }
          try {
            const res = await inspectTray(blob);
            if (res && res.total_eggs_detected > 0) {
              ingestResult(res);
              drawOverlaysOnCanvas(res, vWidth, vHeight);
            } else {
              // Clear overlay if no eggs visible
              const canvas = overlayCanvasRef.current;
              if (canvas) {
                const cCtx = canvas.getContext("2d");
                cCtx?.clearRect(0, 0, canvas.width, canvas.height);
              }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            addLog("AI", `Inference warning: ${msg}`, "info");
          } finally {
            setIsProcessingFrame(false);
          }
        },
        "image/jpeg",
        0.85
      );
    } catch {
      setIsProcessingFrame(false);
    }
  }, [isProcessingFrame, ingestResult, drawOverlaysOnCanvas, addLog]);

  // Start live webcam/phone camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
      setIsCameraActive(true);
      addLog(
        "CAM",
        `Camera stream online (${cameraFacing === "environment" ? "Rear Conveyor View" : "Front View"})`,
        "info"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Camera access denied or unavailable: ${msg}`);
      setIsCameraActive(false);
    }
  }, [cameraFacing, addLog]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    addLog("CAM", "Camera stream disconnected", "info");
  }, [addLog]);

  // Toggle Camera facing (rear vs front)
  const toggleCameraFacing = useCallback(() => {
    stopCamera();
    setCameraFacing((f) => (f === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  // Continuous Camera Scanning Interval
  useEffect(() => {
    if (!isCameraActive || !isContinuousScanning) {
      if (cameraLoopRef.current) clearInterval(cameraLoopRef.current);
      return;
    }

    cameraLoopRef.current = setInterval(() => {
      if (isCameraActiveRef.current && isContinuousScanningRef.current) {
        captureCameraScan();
      }
    }, scanIntervalMs);

    return () => {
      if (cameraLoopRef.current) clearInterval(cameraLoopRef.current);
    };
  }, [isCameraActive, isContinuousScanning, scanIntervalMs, captureCameraScan]);

  // --- VIRTUAL SIMULATION CYCLE ---
  const processVirtualCycle = useCallback(async () => {
    if (isProcessingFrame) return;
    setIsProcessingFrame(true);

    try {
      setBeltPhase("infeed");
      setBeltPosition(20);
      setSensorTripped(true);
      addLog(
        "PLC",
        `Photocell #1 tripped: Tray (${traySize} eggs) entering optical booth`,
        "trigger"
      );

      await new Promise((r) => setTimeout(r, 350));
      setBeltPhase("inspecting");
      setBeltPosition(50);
      setSensorTripped(false);

      if (strobeEnabled) {
        setStrobeFlashed(true);
        setTimeout(() => setStrobeFlashed(false), 180);
      }

      const res = await simulateConveyorFrame(traySize, defectRate, 0.5, 0.5);
      ingestResult(res);

      await new Promise((r) => setTimeout(r, 450));
      setBeltPhase("diverting");
      setBeltPosition(80);

      await new Promise((r) => setTimeout(r, 300));
      setBeltPhase("clear");
      setBeltPosition(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("PLC", `Virtual fault: ${msg}`, "reject");
    } finally {
      setIsProcessingFrame(false);
      setBeltPosition(0);
    }
  }, [isProcessingFrame, traySize, defectRate, strobeEnabled, addLog, ingestResult]);

  // Virtual Run Timer
  useEffect(() => {
    if (!isVirtualRunning) {
      if (virtualLoopRef.current) clearInterval(virtualLoopRef.current);
      return;
    }

    const eggsPerTray = Number(traySize);
    const traysPerHr = beltSpeedEggsPerHr / eggsPerTray;
    const msPerTray = Math.max(1600, Math.round((3600 / traysPerHr) * 1000));

    virtualLoopRef.current = setInterval(() => {
      if (isVirtualRunningRef.current) {
        processVirtualCycle();
      }
    }, msPerTray);

    const initialTimer = setTimeout(() => {
      if (isVirtualRunningRef.current) {
        processVirtualCycle();
      }
    }, 80);

    return () => {
      clearTimeout(initialTimer);
      if (virtualLoopRef.current) clearInterval(virtualLoopRef.current);
    };
  }, [isVirtualRunning, beltSpeedEggsPerHr, traySize, processVirtualCycle]);

  // --- INDUSTRIAL RTSP / NETWORK CAMERA CYCLE ---
  const captureIndustrialFrame = useCallback(async () => {
    if (isProcessingFrame) return;
    setIsProcessingFrame(true);
    try {
      const res = await fetchIndustrialCameraFrame(industrialStreamUrl);
      if (res && res.total_eggs_detected > 0) {
        ingestResult(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("CAM", `Industrial camera error: ${msg}`, "reject");
      setIsIndustrialActive(false);
    } finally {
      setIsProcessingFrame(false);
    }
  }, [industrialStreamUrl, isProcessingFrame, ingestResult, addLog]);

  useEffect(() => {
    if (!isIndustrialActive) {
      if (industrialLoopRef.current) clearInterval(industrialLoopRef.current);
      return;
    }

    industrialLoopRef.current = setInterval(() => {
      if (isIndustrialActiveRef.current) {
        captureIndustrialFrame();
      }
    }, scanIntervalMs);

    const initialTimer = setTimeout(() => {
      if (isIndustrialActiveRef.current) {
        captureIndustrialFrame();
      }
    }, 100);

    return () => {
      clearTimeout(initialTimer);
      if (industrialLoopRef.current) clearInterval(industrialLoopRef.current);
    };
  }, [isIndustrialActive, scanIntervalMs, captureIndustrialFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Export PLC Actuator Log
  function handleExportPlcLog() {
    const payload = {
      timestamp: new Date().toISOString(),
      source_mode: sourceMode,
      session_summary: {
        total_eggs_inspected: sessionTotalEggs,
        grade_a_count: sessionGradeA,
        grade_b_count: sessionGradeB,
        cracks_diverted: sessionCracksDiverted,
        stains_diverted: sessionStainsDiverted,
        blood_diverted: sessionBloodDiverted,
      },
      current_tray: trayResult,
      fieldbus_event_log: logs,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plc_conveyor_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const beltSpeedFtMin = ((beltSpeedEggsPerHr / (Number(traySize) * 60)) * 2.2).toFixed(1);

  return (
    <div className="conveyor-container">
      {/* Industrial Header & Source Mode Switcher */}
      <div className="conveyor-header-card">
        <div className="conveyor-header-titles">
          <div className="scada-badge">
            <span className={`status-dot ${isCameraActive || isVirtualRunning ? "pulse" : ""}`} />
            <span>PLC FIELDBUS SCADA • CONVEYOR LINE #1</span>
          </div>
          <h2>Live Conveyor Belt & Multi-Egg Stream Scanner</h2>
          <p className="conveyor-subtext">
            Instant continuous video inspection for moving trays and conveyor belts. Point your
            camera at eggs moving past to detect defects, localize cracks, and trigger pneumatic
            rejection in real time.
          </p>
        </div>

        {/* Source Mode Toggle: Live Camera vs Industrial Camera vs Virtual Simulation */}
        <div className="conveyor-mode-toggle-group">
          <button
            type="button"
            className={`pill-btn ${sourceMode === "camera" ? "active" : ""}`}
            onClick={() => {
              setIsVirtualRunning(false);
              setIsIndustrialActive(false);
              setSourceMode("camera");
            }}
          >
            📱 Handheld Phone Camera
          </button>
          <button
            type="button"
            className={`pill-btn ${sourceMode === "industrial" ? "active" : ""}`}
            onClick={() => {
              stopCamera();
              setIsVirtualRunning(false);
              setSourceMode("industrial");
            }}
          >
            🏭 Industrial Machine Vision Camera
          </button>
          <button
            type="button"
            className={`pill-btn ${sourceMode === "virtual" ? "active" : ""}`}
            onClick={() => {
              stopCamera();
              setIsIndustrialActive(false);
              setSourceMode("virtual");
            }}
          >
            ⚙️ Virtual Conveyor Sim
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportPlcLog}>
            📥 Export PLC Log
          </button>
        </div>
      </div>

      {/* --- MODE 1: LIVE CAMERA STREAM SCANNER --- */}
      {sourceMode === "camera" && (
        <div className="conveyor-camera-layout">
          {/* Controls Bar for Live Camera */}
          <div className="conveyor-camera-controls-bar">
            <div className="controls-left">
              {!isCameraActive ? (
                <button type="button" className="btn btn-primary" onClick={startCamera}>
                  📹 Start Live Conveyor Camera
                </button>
              ) : (
                <button type="button" className="btn btn-warning" onClick={stopCamera}>
                  ⏹ Stop Camera
                </button>
              )}

              {isCameraActive && (
                <>
                  <button
                    type="button"
                    className={`btn ${isContinuousScanning ? "btn-secondary active" : "btn-secondary"}`}
                    onClick={() => setIsContinuousScanning(!isContinuousScanning)}
                  >
                    {isContinuousScanning ? "⚡ Auto-Scan: ON" : "⏸ Auto-Scan: PAUSED"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={captureCameraScan}
                    disabled={isProcessingFrame}
                  >
                    📸 Instant Snap Frame
                  </button>

                  <button type="button" className="btn btn-secondary" onClick={toggleCameraFacing}>
                    🔄 Switch Camera ({cameraFacing === "environment" ? "Rear" : "Front"})
                  </button>
                </>
              )}
            </div>

            <div className="controls-right">
              <button
                type="button"
                className={`pill-btn ${audioFeedback ? "active" : ""}`}
                onClick={() => setAudioFeedback(!audioFeedback)}
              >
                {audioFeedback ? "🔊 Chime ON" : "🔇 Muted"}
              </button>

              <label className="scan-speed-selector">
                <span>Polling:</span>
                <select
                  value={scanIntervalMs}
                  onChange={(e) => setScanIntervalMs(Number(e.target.value))}
                >
                  <option value={200}>Ultra-Fast (5 FPS / 200ms)</option>
                  <option value={300}>High-Speed (3.3 FPS / 300ms)</option>
                  <option value={500}>Balanced (2 FPS / 500ms)</option>
                  <option value={1000}>Relaxed (1 FPS / 1000ms)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Active Pneumatic Divert Banner Notification */}
          {activeDivertAlert && (
            <div className="conveyor-divert-banner">
              <span className="banner-icon">🚨</span>
              <span className="banner-text">{activeDivertAlert}</span>
            </div>
          )}

          {/* Live Viewport with Canvas Bounding Box Overlays */}
          <div className="conveyor-camera-viewport-card">
            <div className="conveyor-camera-stage">
              <video ref={videoRef} className="conveyor-live-video" autoPlay playsInline muted />
              <canvas ref={overlayCanvasRef} className="conveyor-overlay-canvas" />

              {/* Scanning Laser Guide */}
              {isCameraActive && isContinuousScanning && (
                <div className="conveyor-laser-scanline" />
              )}

              {/* Camera Standby Placeholder */}
              {!isCameraActive && (
                <div className="conveyor-camera-idle-overlay">
                  <span className="idle-cam-icon">📹</span>
                  <h3>Conveyor Camera Inactive</h3>
                  <p>
                    Position phone or webcam overhead facing your moving egg conveyor belt or egg
                    flat.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={startCamera}>
                    Activate Conveyor Camera
                  </button>
                </div>
              )}

              {/* Top Viewport HUD Overlay Bar */}
              {isCameraActive && (
                <div className="camera-viewport-hud">
                  <div className="hud-pill">
                    <span className={`status-dot ${isProcessingFrame ? "pulse" : ""}`} />
                    <span>
                      {isProcessingFrame
                        ? "AI INFERENCE RUNNING..."
                        : `LINE READY • ${lastInferenceTimeMs.toFixed(1)}ms LATENCY`}
                    </span>
                  </div>
                  <div className="hud-pill">
                    <span>
                      EGGS IN VIEW: <strong>{trayResult?.total_eggs_detected || 0}</strong>
                    </span>
                  </div>
                  <div className="hud-pill">
                    <span>
                      REJECTS: <strong>{trayResult?.reject_count || 0}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 2: INDUSTRIAL MACHINE VISION & RTSP IP CAMERA --- */}
      {sourceMode === "industrial" && (
        <div className="conveyor-camera-layout">
          {/* Controls Bar for Industrial Stream */}
          <div className="conveyor-camera-controls-bar">
            <div className="controls-left">
              <input
                type="text"
                className="industrial-url-input"
                value={industrialStreamUrl}
                onChange={(e) => setIndustrialStreamUrl(e.target.value)}
                placeholder="RTSP URL (rtsp://192.168.1.100:554/stream) or USB Dev '0'"
                style={{
                  background: "var(--bg-sunken)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.8rem",
                  minWidth: "280px",
                }}
              />

              {!isIndustrialActive ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setIsIndustrialActive(true);
                    addLog(
                      "CAM",
                      `Connecting to industrial camera: ${industrialStreamUrl}`,
                      "info"
                    );
                  }}
                >
                  ▶ Connect Industrial Stream
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => {
                    setIsIndustrialActive(false);
                    addLog("CAM", "Disconnected industrial stream", "info");
                  }}
                >
                  ⏹ Disconnect Stream
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={captureIndustrialFrame}
                disabled={isProcessingFrame}
              >
                📸 Snap Frame
              </button>
            </div>

            <div className="controls-right">
              <button
                type="button"
                className={`pill-btn ${audioFeedback ? "active" : ""}`}
                onClick={() => setAudioFeedback(!audioFeedback)}
              >
                {audioFeedback ? "🔊 Chime ON" : "🔇 Muted"}
              </button>

              <label className="scan-speed-selector">
                <span>Polling:</span>
                <select
                  value={scanIntervalMs}
                  onChange={(e) => setScanIntervalMs(Number(e.target.value))}
                >
                  <option value={200}>Ultra-Fast (5 FPS / 200ms)</option>
                  <option value={300}>High-Speed (3.3 FPS / 300ms)</option>
                  <option value={500}>Balanced (2 FPS / 500ms)</option>
                  <option value={1000}>Relaxed (1 FPS / 1000ms)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Quick Presets for Industrial Machine Vision Setup */}
          <div
            className="industrial-presets-bar"
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              fontSize: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Camera Presets:</span>
            <button type="button" className="pill-btn" onClick={() => setIndustrialStreamUrl("0")}>
              USB Machine Vision (Dev 0)
            </button>
            <button type="button" className="pill-btn" onClick={() => setIndustrialStreamUrl("1")}>
              USB Machine Vision (Dev 1)
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => setIndustrialStreamUrl("rtsp://192.168.1.100:554/stream1")}
            >
              RTSP Network Stream
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => setIndustrialStreamUrl("http://192.168.1.100:8080/video")}
            >
              HTTP MJPEG Stream
            </button>
          </div>

          {/* Active Pneumatic Divert Banner Notification */}
          {activeDivertAlert && (
            <div className="conveyor-divert-banner">
              <span className="banner-icon">🚨</span>
              <span className="banner-text">{activeDivertAlert}</span>
            </div>
          )}

          {/* Industrial Viewport Card */}
          <div className="conveyor-camera-viewport-card">
            <div className="conveyor-camera-stage">
              {trayResult?.annotated_tray_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trayResult.annotated_tray_image}
                  alt="Industrial Machine Vision Feed"
                  className="conveyor-live-video"
                />
              ) : (
                <div className="conveyor-camera-idle-overlay">
                  <span className="idle-cam-icon">🏭</span>
                  <h3>Industrial Machine Vision Stream</h3>
                  <p>
                    Connect directly to overhead GigE Vision, USB3, or RTSP/IP machine vision
                    cameras mounted above the conveyor line.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setIsIndustrialActive(true);
                      addLog(
                        "CAM",
                        `Connecting to industrial camera: ${industrialStreamUrl}`,
                        "info"
                      );
                    }}
                  >
                    Connect Camera Stream
                  </button>
                </div>
              )}

              {isIndustrialActive && <div className="conveyor-laser-scanline" />}

              {isIndustrialActive && (
                <div className="camera-viewport-hud">
                  <div className="hud-pill">
                    <span className={`status-dot ${isProcessingFrame ? "pulse" : ""}`} />
                    <span>
                      {isProcessingFrame
                        ? "PULLING INDUSTRIAL FRAME..."
                        : `INDUSTRIAL LINK OK • ${lastInferenceTimeMs.toFixed(1)}ms`}
                    </span>
                  </div>
                  <div className="hud-pill">
                    <span>
                      SOURCE: <strong>{industrialStreamUrl}</strong>
                    </span>
                  </div>
                  <div className="hud-pill">
                    <span>
                      REJECTS: <strong>{trayResult?.reject_count || 0}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 3: VIRTUAL SIMULATION BENCH --- */}
      {sourceMode === "virtual" && (
        <div className="conveyor-virtual-layout">
          {/* Virtual Controls Grid */}
          <div className="conveyor-controls-grid">
            <div className="control-card">
              <label className="control-label" htmlFor="virtualBeltSpeed">
                <span>Belt Speed:</span>
                <strong>{beltSpeedEggsPerHr.toLocaleString()} eggs/hr</strong>
              </label>
              <input
                id="virtualBeltSpeed"
                type="range"
                min="600"
                max="3600"
                step="300"
                value={beltSpeedEggsPerHr}
                onChange={(e) => setBeltSpeedEggsPerHr(Number(e.target.value))}
              />
              <div className="control-meta-sub">
                <span>Speed: {beltSpeedFtMin} ft/min</span>
                <span>{(beltSpeedEggsPerHr / Number(traySize) / 60).toFixed(1)} trays/min</span>
              </div>
            </div>

            <div className="control-card">
              <label className="control-label" htmlFor="virtualTrayFormat">
                <span>Tray Format:</span>
                <strong>
                  {traySize === "30"
                    ? "30-Egg Flat (5×6)"
                    : traySize === "12"
                      ? "12-Egg Carton (2×6)"
                      : "6-Egg Pack (2×3)"}
                </strong>
              </label>
              <div className="pill-group" id="virtualTrayFormat">
                {(["30", "12", "6"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`pill-btn ${traySize === size ? "active" : ""}`}
                    onClick={() => {
                      setTraySize(size);
                      setTrayResult(null);
                    }}
                  >
                    {size} Eggs
                  </button>
                ))}
              </div>
            </div>

            <div className="control-card">
              <label className="control-label" htmlFor="virtualDefectRate">
                <span>Defect Injection:</span>
                <strong>{Math.round(defectRate * 100)}%</strong>
              </label>
              <input
                id="virtualDefectRate"
                type="range"
                min="0"
                max="0.40"
                step="0.05"
                value={defectRate}
                onChange={(e) => setDefectRate(Number(e.target.value))}
              />
              <div className="control-meta-sub">
                <span>0% Clean Run</span>
                <span>40% High Defect</span>
              </div>
            </div>

            <div className="control-card">
              <label className="control-label" htmlFor="virtualStrobeToggle">
                <span>Candling Strobe:</span>
                <strong>{strobeEnabled ? "Active (High-CRI)" : "Disabled"}</strong>
              </label>
              <button
                id="virtualStrobeToggle"
                type="button"
                className={`pill-btn ${strobeEnabled ? "active" : ""}`}
                onClick={() => setStrobeEnabled(!strobeEnabled)}
                style={{ width: "100%", marginTop: "8px" }}
              >
                {strobeEnabled ? "💡 Strobe Flash ON" : "Off"}
              </button>
            </div>
          </div>

          {/* Virtual Conveyor Bed Stage */}
          <div className="conveyor-visual-stage">
            <div className="optical-booth">
              <div className={`candling-hood ${strobeFlashed ? "strobe-active" : ""}`}>
                <div className="camera-housing">
                  <span className="camera-lens">📷</span>
                  <div className="camera-label">
                    <span>OVERHEAD VISION ENCLOSURE</span>
                    <span className="camera-fps">GLOBAL SHUTTER • 60 FPS</span>
                  </div>
                </div>
                {strobeFlashed && <div className="candling-scan-beam" />}
              </div>
            </div>

            <div className={`photocell-sensor ${sensorTripped ? "tripped" : ""}`}>
              <div className="sensor-eye left" />
              <div className="sensor-laser-line" />
              <div className="sensor-eye right" />
              <span className="sensor-tag">
                PHOTO-EYE #1 {sensorTripped ? "[TRIPPED]" : "[CLEAR]"}
              </span>
            </div>

            <div className="conveyor-bed">
              <div className="conveyor-rollers-bg" />
              <div className="conveyor-guide-rails" />

              <div
                className={`conveyor-tray-assembly tray-${traySize} phase-${beltPhase}`}
                style={{
                  left: `${beltPosition}%`,
                  transition: isVirtualRunning ? "left 0.4s ease-in-out" : "left 0.2s ease",
                }}
              >
                <div className="tray-molded-flat">
                  <div className="tray-label-badge">
                    TRAY #
                    {trayResult
                      ? trayResult.filename?.replace(/[^0-9]/g, "").slice(-4) || "101"
                      : "STANDBY"}
                  </div>

                  <div className={`tray-grid grid-${traySize}`}>
                    {trayResult
                      ? trayResult.eggs.map((egg) => {
                          const isReject = egg.grade === "Reject";
                          const isGradeB = egg.grade === "Grade B";
                          const isSelected = selectedEgg?.egg_id === egg.egg_id;
                          const defectType = egg.defects[0]?.defect_type;

                          let eggClass = "egg-pocket grade-a";
                          if (isReject) eggClass = "egg-pocket grade-rej";
                          else if (isGradeB) eggClass = "egg-pocket grade-b";

                          return (
                            <div
                              key={egg.egg_id}
                              className={`${eggClass} ${isSelected ? "selected" : ""}`}
                              onClick={() => setSelectedEgg(egg)}
                              title={`Egg #${egg.egg_id} (${egg.pocket_label}): ${egg.grade} - ${egg.recommendation}`}
                            >
                              <span className="pocket-egg-shell">
                                {isReject
                                  ? defectType === "crack"
                                    ? "⚡"
                                    : defectType === "dirt_stain"
                                      ? "🟤"
                                      : "🩸"
                                  : "🥚"}
                              </span>
                              <span className="pocket-badge-id">#{egg.egg_id}</span>
                            </div>
                          );
                        })
                      : Array.from({ length: Number(traySize) }).map((_, i) => (
                          <div key={i} className="egg-pocket placeholder">
                            <span className="pocket-egg-shell">🥚</span>
                            <span className="pocket-badge-id">#{i + 1}</span>
                          </div>
                        ))}
                  </div>
                </div>
              </div>

              {/* Chutes */}
              <div className="divert-actuator-station">
                <div className="station-label">PNEUMATIC DIVERT CHUTES</div>
                <div className="chutes-group">
                  <div className="chute-item chute-main">
                    <span className="chute-tag">MAIN BELT</span>
                    <span className="chute-desc">USDA Grade A/B</span>
                    <span className="chute-count">{sessionGradeA + sessionGradeB}</span>
                  </div>

                  <div
                    className={`chute-item chute-1 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
                  >
                    <div className="pneumatic-piston" />
                    <span className="chute-tag">CHUTE #1 (CRACK)</span>
                    <span className="chute-desc">Liquid Egg</span>
                    <span className="chute-count">{sessionCracksDiverted}</span>
                  </div>

                  <div
                    className={`chute-item chute-2 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
                  >
                    <div className="pneumatic-piston" />
                    <span className="chute-tag">CHUTE #2 (DIRT)</span>
                    <span className="chute-desc">Wash / Reclean</span>
                    <span className="chute-count">{sessionStainsDiverted}</span>
                  </div>

                  <div
                    className={`chute-item chute-3 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
                  >
                    <div className="pneumatic-piston" />
                    <span className="chute-tag">CHUTE #3 (LOSS)</span>
                    <span className="chute-desc">Inedible</span>
                    <span className="chute-count">{sessionBloodDiverted}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Actions */}
          <div className="virtual-actions-row">
            <button
              type="button"
              className={`btn ${isVirtualRunning ? "btn-warning" : "btn-primary"}`}
              onClick={() => setIsVirtualRunning(!isVirtualRunning)}
            >
              {isVirtualRunning ? "⏸ Pause Virtual Line" : "▶ Start Virtual Conveyor"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isVirtualRunning || isProcessingFrame}
              onClick={processVirtualCycle}
            >
              ⏭ Step Single Tray
            </button>
          </div>
        </div>
      )}

      {/* Industrial Telemetry Dashboard Strip */}
      <div className="conveyor-telemetry-strip">
        <div className="telemetry-block">
          <span className="telemetry-label">LINE THROUGHPUT</span>
          <span className="telemetry-value">
            {sourceMode === "camera"
              ? sessionTotalEggs > 0
                ? `${Math.round((sessionTotalEggs / Math.max(1, logs.length)) * 1200)} `
                : "Active "
              : beltSpeedEggsPerHr.toLocaleString()}{" "}
            <small>eggs/hr</small>
          </span>
          <span className="telemetry-sub">Continuous Real-Time Rate</span>
        </div>

        <div className="telemetry-block">
          <span className="telemetry-label">INFERENCE LATENCY</span>
          <span className="telemetry-value">
            {lastInferenceTimeMs.toFixed(1)} <small>ms</small>
          </span>
          <span className="telemetry-sub">Overhead Camera to Edge AI</span>
        </div>

        <div className="telemetry-block">
          <span className="telemetry-label">ROTARY ENCODER</span>
          <span className="telemetry-value">
            #{encoderPulses.toLocaleString()} <small>pulses</small>
          </span>
          <span className="telemetry-sub">Synchronized line distance</span>
        </div>

        <div className="telemetry-block">
          <span className="telemetry-label">LOT PASS YIELD</span>
          <span className="telemetry-value">
            {sessionTotalEggs > 0
              ? `${(((sessionGradeA + sessionGradeB) / sessionTotalEggs) * 100).toFixed(1)}%`
              : "100%"}
          </span>
          <span className="telemetry-sub">
            {sessionGradeA + sessionGradeB} of {sessionTotalEggs} marketable
          </span>
        </div>
      </div>

      {/* Details Grid: Frame Inspection + PLC Fieldbus Terminal */}
      <div className="conveyor-details-grid">
        {/* Left: Annotated Frame & Selected Pocket Inspector */}
        <div className="card conveyor-detail-card">
          <div className="section-title-group">
            <h3>Recent Frame Capture & Telemetry</h3>
            <p className="section-desc">
              High-resolution frame with numbered contour rings and defect localization.
            </p>
          </div>

          {trayResult?.annotated_tray_image ? (
            <div className="conveyor-annotated-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trayResult.annotated_tray_image}
                alt="Overhead camera annotated inspection"
                className="conveyor-annotated-img"
              />
            </div>
          ) : (
            <div className="conveyor-annotated-placeholder">
              <span className="placeholder-icon">📹</span>
              <p>Start live camera scan or virtual conveyor to acquire an optical frame.</p>
            </div>
          )}

          {selectedEgg && (
            <div className="selected-pocket-card">
              <div className="pocket-card-header">
                <h4>Pocket {selectedEgg.pocket_label || `#${selectedEgg.egg_id}`} Telemetry</h4>
                <span
                  className={`badge ${
                    selectedEgg.grade === "Grade A"
                      ? "badge-a"
                      : selectedEgg.grade === "Grade B"
                        ? "badge-b"
                        : "badge-reject"
                  }`}
                >
                  {selectedEgg.grade}
                </span>
              </div>
              <div className="pocket-card-body">
                <div className="pocket-stat">
                  <span>Quality Score:</span>
                  <strong>{selectedEgg.quality_score.toFixed(1)} / 100</strong>
                </div>
                <div className="pocket-stat">
                  <span>Actuator Action:</span>
                  <strong>{selectedEgg.actuator_action || "PASS"}</strong>
                </div>
                <div className="pocket-stat">
                  <span>Chute Target:</span>
                  <strong>{selectedEgg.chute_target || "Main Packaging"}</strong>
                </div>
                <div className="pocket-stat">
                  <span>Defects Localized:</span>
                  <strong>{selectedEgg.defect_count} found</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Real-time Industrial PLC Event Feed */}
        <div className="card conveyor-detail-card">
          <div className="section-title-group plc-terminal-header">
            <div>
              <h3>Industrial PLC Fieldbus Terminal</h3>
              <p className="section-desc">
                Real-time digital I/O events, photocell triggers, and pneumatic solenoid commands.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
              onClick={() => setLogs([])}
            >
              Clear Log
            </button>
          </div>

          <div className="plc-terminal-body">
            {logs.length === 0 ? (
              <div className="terminal-idle-msg">
                Fieldbus communication online. Awaiting line triggers...
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`terminal-line terminal-${log.type}`}>
                  <span className="terminal-time">[{log.timestamp}]</span>
                  <span className={`terminal-source src-${log.source.toLowerCase()}`}>
                    {log.source}
                  </span>
                  <span className="terminal-text">{log.text}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
