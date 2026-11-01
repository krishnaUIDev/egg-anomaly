"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { simulateConveyorFrame } from "../lib/api";
import { TrayInspectionResult, TrayEggItem, PlcActuatorSignal } from "../lib/types";

interface PlcLogMessage {
  id: string;
  timestamp: string;
  source: "PLC" | "CAM" | "AI" | "ACTUATOR";
  text: string;
  type: "info" | "trigger" | "reject" | "pass";
}

export function ConveyorSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [traySize, setTraySize] = useState<"30" | "12" | "6">("30");
  const [defectRate, setDefectRate] = useState(0.15);
  const [beltSpeedEggsPerHr, setBeltSpeedEggsPerHr] = useState(1800);
  const [strobeEnabled, setStrobeEnabled] = useState(true);
  const crackSensitivity = 0.5;
  const stainSensitivity = 0.5;

  // Live simulation states
  const [trayResult, setTrayResult] = useState<TrayInspectionResult | null>(null);
  const [selectedEgg, setSelectedEgg] = useState<TrayEggItem | null>(null);
  const [beltPosition, setBeltPosition] = useState(0); // 0 to 100%
  const [beltPhase, setBeltPhase] = useState<"infeed" | "inspecting" | "diverting" | "clear">(
    "clear"
  );
  const [activeSolenoids, setActiveSolenoids] = useState<number[]>([]);
  const [sensorTripped, setSensorTripped] = useState(false);
  const [strobeFlashed, setStrobeFlashed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Telemetry metrics
  const [encoderPulses, setEncoderPulses] = useState(14820);
  const [sessionTotalEggs, setSessionTotalEggs] = useState(0);
  const [sessionGradeA, setSessionGradeA] = useState(0);
  const [sessionGradeB, setSessionGradeB] = useState(0);
  const [sessionCracksDiverted, setSessionCracksDiverted] = useState(0);
  const [sessionStainsDiverted, setSessionStainsDiverted] = useState(0);
  const [sessionBloodDiverted, setSessionBloodDiverted] = useState(0);
  const [lastInferenceTimeMs, setLastInferenceTimeMs] = useState(0);
  const [logs, setLogs] = useState<PlcLogMessage[]>([]);

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const runLoopRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

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

  // Execute a single tray cycle
  const processTrayCycle = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Infeed phase
      setBeltPhase("infeed");
      setBeltPosition(20);
      setSensorTripped(true);
      addLog(
        "PLC",
        `Photocell #1 tripped: Tray (${traySize} eggs) entering optical booth`,
        "trigger"
      );

      // 2. Candling & AI Inspection phase
      await new Promise((r) => setTimeout(r, 350));
      setBeltPhase("inspecting");
      setBeltPosition(50);
      setSensorTripped(false);

      if (strobeEnabled) {
        setStrobeFlashed(true);
        setTimeout(() => setStrobeFlashed(false), 180);
      }
      addLog(
        "CAM",
        "High-CRI candling strobe fired: Frame captured (60 FPS global shutter)",
        "info"
      );

      const startTime = performance.now();
      const result = await simulateConveyorFrame(
        traySize,
        defectRate,
        crackSensitivity,
        stainSensitivity
      );
      const elapsed = Math.round(performance.now() - startTime);

      setTrayResult(result);
      setLastInferenceTimeMs(result.processing_time_ms || elapsed);
      setEncoderPulses((p) => p + 180);

      // Tally metrics
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

      const rejectCount = result.reject_count;
      addLog(
        "AI",
        `Inference completed in ${result.processing_time_ms}ms: ${result.total_eggs_detected} eggs (${result.grade_a_count} A, ${result.grade_b_count} B, ${rejectCount} Rejects)`,
        rejectCount > 0 ? "reject" : "pass"
      );

      // 3. Actuator Divert phase
      await new Promise((r) => setTimeout(r, 450));
      setBeltPhase("diverting");
      setBeltPosition(80);

      if (result.plc_signals && result.plc_signals.length > 0) {
        const valves = result.plc_signals.map((s) => s.solenoid_valve_id);
        setActiveSolenoids(valves);

        result.plc_signals.forEach((sig: PlcActuatorSignal) => {
          addLog(
            "ACTUATOR",
            `Solenoid #${sig.solenoid_valve_id} fired @ Pulse +${sig.encoder_pulse_offset}: Diverted ${sig.pocket_label} (${sig.primary_defect || "Reject"}) -> ${sig.target_chute}`,
            "reject"
          );
        });

        setTimeout(() => setActiveSolenoids([]), 400);
      } else {
        addLog(
          "PLC",
          "All eggs passed inspection: Divert valves idle -> Route to Main Carton Pack",
          "pass"
        );
      }

      // 4. Clear phase
      await new Promise((r) => setTimeout(r, 300));
      setBeltPhase("clear");
      setBeltPosition(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("PLC", `Conveyor fault: ${msg}`, "reject");
    } finally {
      setIsProcessing(false);
      setBeltPosition(0);
    }
  }, [
    isProcessing,
    traySize,
    defectRate,
    crackSensitivity,
    stainSensitivity,
    strobeEnabled,
    addLog,
  ]);

  // Continuous run timer
  useEffect(() => {
    if (!isRunning) {
      if (runLoopRef.current) clearInterval(runLoopRef.current);
      return;
    }

    // Interval derived from belt speed: eggs/hr to ms per tray
    const eggsPerTray = Number(traySize);
    const traysPerHr = beltSpeedEggsPerHr / eggsPerTray;
    const msPerTray = Math.max(1600, Math.round((3600 / traysPerHr) * 1000));

    runLoopRef.current = setInterval(() => {
      if (isRunningRef.current) {
        processTrayCycle();
      }
    }, msPerTray);

    // Initial trigger after delay
    const initialTimer = setTimeout(() => {
      if (isRunningRef.current) {
        processTrayCycle();
      }
    }, 80);

    return () => {
      clearTimeout(initialTimer);
      if (runLoopRef.current) clearInterval(runLoopRef.current);
    };
  }, [isRunning, beltSpeedEggsPerHr, traySize, processTrayCycle]);

  // Export PLC Actuator Log
  function handleExportPlcLog() {
    const payload = {
      timestamp: new Date().toISOString(),
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

  // Calculate speed in ft/min
  const beltSpeedFtMin = ((beltSpeedEggsPerHr / (Number(traySize) * 60)) * 2.2).toFixed(1);

  return (
    <div className="conveyor-container">
      {/* Title & Industrial Header */}
      <div className="conveyor-header-card">
        <div className="conveyor-header-titles">
          <div className="scada-badge">
            <span className={`status-dot ${isRunning ? "pulse" : ""}`} />
            <span>PLC FIELDBUS SCADA • CONVEYOR LINE #1</span>
          </div>
          <h2>Industrial Conveyor & Multi-Egg Tray Candling</h2>
          <p className="conveyor-subtext">
            High-speed continuous sorting simulation with overhead candling chamber, optical sensor
            sync, and pneumatic solenoid diverter actuation.
          </p>
        </div>

        <div className="conveyor-header-actions">
          <button
            type="button"
            className={`btn ${isRunning ? "btn-warning" : "btn-primary"}`}
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? "⏸ Pause Line" : "▶ Start Conveyor"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isRunning || isProcessing}
            onClick={processTrayCycle}
          >
            ⏭ Step Single Tray
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportPlcLog}>
            📥 Export PLC Log
          </button>
        </div>
      </div>

      {/* Industrial Controls Matrix */}
      <div className="conveyor-controls-grid">
        <div className="control-card">
          <label className="control-label" htmlFor="beltSpeedInput">
            <span>Belt Speed:</span>
            <strong>{beltSpeedEggsPerHr.toLocaleString()} eggs/hr</strong>
          </label>
          <input
            id="beltSpeedInput"
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
          <label className="control-label" htmlFor="trayFormatSelect">
            <span>Tray Format:</span>
            <strong>
              {traySize === "30"
                ? "30-Egg Flat (5×6)"
                : traySize === "12"
                  ? "12-Egg Carton (2×6)"
                  : "6-Egg Pack (2×3)"}
            </strong>
          </label>
          <div className="pill-group" id="trayFormatSelect">
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
          <label className="control-label" htmlFor="defectRateInput">
            <span>Defect Injection:</span>
            <strong>{Math.round(defectRate * 100)}%</strong>
          </label>
          <input
            id="defectRateInput"
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
          <label className="control-label" htmlFor="strobeToggleBtn">
            <span>Candling Strobe:</span>
            <strong>{strobeEnabled ? "Active (High-CRI)" : "Disabled"}</strong>
          </label>
          <button
            id="strobeToggleBtn"
            type="button"
            className={`pill-btn ${strobeEnabled ? "active" : ""}`}
            onClick={() => setStrobeEnabled(!strobeEnabled)}
            style={{ width: "100%", marginTop: "8px" }}
          >
            {strobeEnabled ? "💡 Strobe Flash ON" : "Off"}
          </button>
        </div>
      </div>

      {/* Industrial Conveyor Visual Stage */}
      <div className="conveyor-visual-stage">
        {/* Overhead Camera & Candling Hood */}
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

        {/* Photocell Sensor Trip Beam */}
        <div className={`photocell-sensor ${sensorTripped ? "tripped" : ""}`}>
          <div className="sensor-eye left" />
          <div className="sensor-laser-line" />
          <div className="sensor-eye right" />
          <span className="sensor-tag">PHOTO-EYE #1 {sensorTripped ? "[TRIPPED]" : "[CLEAR]"}</span>
        </div>

        {/* The Conveyor Bed & Roller Surface */}
        <div className="conveyor-bed">
          <div className="conveyor-rollers-bg" />
          <div className="conveyor-guide-rails" />

          {/* The Moving Egg Tray */}
          <div
            className={`conveyor-tray-assembly tray-${traySize} phase-${beltPhase}`}
            style={{
              left: `${beltPosition}%`,
              transition: isRunning ? "left 0.4s ease-in-out" : "left 0.2s ease",
            }}
          >
            <div className="tray-molded-flat">
              <div className="tray-label-badge">
                TRAY #
                {trayResult
                  ? trayResult.filename?.replace(/[^0-9]/g, "").slice(-4) || "101"
                  : "STANDBY"}
              </div>

              {/* Egg Pocket Matrix Grid */}
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
                  : // Placeholder empty pockets
                    Array.from({ length: Number(traySize) }).map((_, i) => (
                      <div key={i} className="egg-pocket placeholder">
                        <span className="pocket-egg-shell">🥚</span>
                        <span className="pocket-badge-id">#{i + 1}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>

          {/* Downstream Pneumatic Reject Actuators & Chutes */}
          <div className="divert-actuator-station">
            <div className="station-label">PNEUMATIC DIVERT CHUTES</div>
            <div className="chutes-group">
              <div className="chute-item chute-main">
                <span className="chute-tag">MAIN BELT</span>
                <span className="chute-desc">USDA Grade A/B Pack</span>
                <span className="chute-count">{sessionGradeA + sessionGradeB}</span>
              </div>

              <div
                className={`chute-item chute-1 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
              >
                <div className="pneumatic-piston" />
                <span className="chute-tag">CHUTE #1 (CRACK)</span>
                <span className="chute-desc">Liquid Egg Salvage</span>
                <span className="chute-count">{sessionCracksDiverted}</span>
              </div>

              <div
                className={`chute-item chute-2 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
              >
                <div className="pneumatic-piston" />
                <span className="chute-tag">CHUTE #2 (DIRT)</span>
                <span className="chute-desc">Reclean / Wash</span>
                <span className="chute-count">{sessionStainsDiverted}</span>
              </div>

              <div
                className={`chute-item chute-3 ${activeSolenoids.length > 0 ? "actuator-firing" : ""}`}
              >
                <div className="pneumatic-piston" />
                <span className="chute-tag">CHUTE #3 (LOSS)</span>
                <span className="chute-desc">Inedible / Discard</span>
                <span className="chute-count">{sessionBloodDiverted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Industrial Telemetry Dashboard Strip */}
      <div className="conveyor-telemetry-strip">
        <div className="telemetry-block">
          <span className="telemetry-label">LINE THROUGHPUT</span>
          <span className="telemetry-value">
            {beltSpeedEggsPerHr.toLocaleString()} <small>eggs/hr</small>
          </span>
          <span className="telemetry-sub">{beltSpeedFtMin} ft/min belt speed</span>
        </div>

        <div className="telemetry-block">
          <span className="telemetry-label">INSPECTION LATENCY</span>
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
          <span className="telemetry-sub">1 mm / pulse resolution</span>
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

      {/* Dual Detail Section: Live Annotated Frame + PLC Fieldbus Terminal */}
      <div className="conveyor-details-grid">
        {/* Left: Annotated Frame & Selected Pocket Inspector */}
        <div className="card conveyor-detail-card">
          <div className="section-title-group">
            <h3>Overhead Vision Capture</h3>
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
              <p>
                Start conveyor or click &quot;Step Single Tray&quot; to acquire an optical frame.
              </p>
            </div>
          )}

          {/* Selected Pocket Telemetry */}
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
