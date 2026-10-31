"use client";

import React, { useState, useEffect, useRef } from "react";
import { OvoHeader } from "../components/OvoHeader";
import { ViewfinderHUD } from "../components/ViewfinderHUD";
import { QuickControls } from "../components/QuickControls";
import { TelemetryMatrix } from "../components/TelemetryMatrix";
import { GradeDecisionCard } from "../components/GradeDecisionCard";
import { LotDistributionCard } from "../components/LotDistributionCard";
import { InspectionLogStream } from "../components/InspectionLogStream";
import { COAModal } from "../components/COAModal";

import { OvoEggScenario, LotStats, LogEntry, DefectItem } from "../lib/types";
import { BENCHMARK_SCENARIOS, INITIAL_LOG_SEEDS } from "../lib/constants";
import { inspectSingleEgg } from "../lib/api";

export default function OvoGradeApp() {
  // System State
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [candlingActive, setCandlingActive] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);
  const [currentEgg, setCurrentEgg] = useState<OvoEggScenario>(BENCHMARK_SCENARIOS[0]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inferLatencyMs, setInferLatencyMs] = useState(14.2);
  const [fps, setFps] = useState(28.4);
  const [isCOAModalOpen, setIsCOAModalOpen] = useState(false);

  // Lot Statistics State
  const [stats, setStats] = useState<LotStats>({
    totalInspected: 340,
    gradeAA: 302,
    gradeA: 28,
    gradeB: 7,
    loss: 3,
  });

  // Recent Inspection Stream Logs
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOG_SEEDS);

  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Simulated FPS jitter for real-time industrial HUD feel
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(28.0 + Math.random() * 1.5);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Start Phone Camera
  async function handleStartCamera() {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoEl = document.querySelector("video") as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play();
      }
      videoTrackRef.current = stream.getVideoTracks()[0] || null;
      setIsWebcamActive(true);
      setIsSimRunning(false);
    } catch (err) {
      console.warn("Direct phone camera not available. Running simulated conveyor feed.", err);
      setIsSimRunning(true);
    }
  }

  // Toggle Hardware Torch Flash
  async function handleToggleTorch() {
    const nextState = !torchActive;
    setTorchActive(nextState);

    if (videoTrackRef.current) {
      try {
        const track = videoTrackRef.current as any;
        const capabilities = track.getCapabilities?.() || {};
        if (capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: nextState }],
          });
        }
      } catch (e) {
        console.warn("Hardware torch error:", e);
      }
    }
  }

  // Toggle Candling Transillumination Mode
  function handleToggleCandling() {
    setCandlingActive((prev) => !prev);
  }

  // Cycle Through Known Benchmark Scenarios
  function handleCycleAnomaly() {
    const nextIdx = (activeSampleIndex + 1) % BENCHMARK_SCENARIOS.length;
    setActiveSampleIndex(nextIdx);
    const scenario = BENCHMARK_SCENARIOS[nextIdx];
    setCurrentEgg(scenario);

    // Auto-enable candling if defect is an internal blood spot or enlarged air cell
    if (scenario.bloodSpotDetected || scenario.airCellMm > 4.0) {
      setCandlingActive(true);
    }
  }

  // Handle uploaded photo
  async function handleFileUpload(file: File) {
    setIsInspecting(true);
    const start = performance.now();
    try {
      const result = await inspectSingleEgg(file, 0.5, 0.5);
      const elapsed = performance.now() - start;
      setInferLatencyMs(elapsed);

      const hasCrack = result.defects.some((d: DefectItem) => d.defect_type === "crack");
      const hasBlood = result.defects.some((d: DefectItem) => d.defect_type === "blood_spot");
      const stainDefect = result.defects.find((d: DefectItem) => d.defect_type === "dirt_stain");
      const dirtPct = stainDefect ? stainDefect.area_ratio * 100 : 0;

      const updatedEgg: OvoEggScenario = {
        sampleName: file.name,
        grade: result.grade === "Grade A" ? "AA" : result.grade === "Grade B" ? "B" : "Loss",
        confidence: result.detection_confidence,
        airCellMm: result.grade === "Grade A" ? 2.8 : 4.5,
        airCellInch: result.grade === "Grade A" ? '7/64"' : '3/16"',
        shellCondition: hasCrack ? "Structural check/fracture" : "Normal, Clean",
        cracksDetected: hasCrack,
        crackSeverity: hasCrack ? 0.85 : 0.02,
        bloodSpotDetected: hasBlood,
        bloodSpotMm: hasBlood ? 3.5 : 0.0,
        dirtPercentage: dirtPct,
        weightGrams: 58.5,
        yolkCentering: "Centered, Indistinct",
      };

      setCurrentEgg(updatedEgg);
      recordInspection(updatedEgg);
    } catch (err: any) {
      alert("Inspection analysis failed: " + err.message);
    } finally {
      setIsInspecting(false);
    }
  }

  // Capture & Log Inspection Transaction (Record SKU)
  function handleCaptureSKU() {
    recordInspection(currentEgg);
  }

  function recordInspection(egg: OvoEggScenario) {
    const timestamp = new Date().toLocaleTimeString();
    const skuId = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;

    // Update tallies
    setStats((prev) => {
      const isAA = egg.grade === "AA";
      const isA = egg.grade === "A";
      const isB = egg.grade.includes("B");
      return {
        totalInspected: prev.totalInspected + 1,
        gradeAA: isAA ? prev.gradeAA + 1 : prev.gradeAA,
        gradeA: isA ? prev.gradeA + 1 : prev.gradeA,
        gradeB: isB ? prev.gradeB + 1 : prev.gradeB,
        loss: !isAA && !isA && !isB ? prev.loss + 1 : prev.loss,
      };
    });

    // Prepend Log Item
    setLogs((prev) => [
      {
        id: Math.random().toString(),
        time: timestamp,
        sku: skuId,
        name: egg.sampleName,
        grade: egg.grade,
        weight: `${egg.weightGrams}g`,
      },
      ...prev,
    ]);
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Enterprise App Header */}
      <OvoHeader
        fps={fps}
        lotNumber="Lot #US-8842"
        onOpenCOA={() => setIsCOAModalOpen(true)}
      />

      {/* Main Dual-Pane Viewport */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 max-w-[1720px] mx-auto w-full">
        {/* Left Column: Viewfinder & Real-Time Matrix (cols 1-7) */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          <ViewfinderHUD
            currentEgg={currentEgg}
            isWebcamActive={isWebcamActive}
            isSimRunning={isSimRunning}
            candlingActive={candlingActive}
            inferLatencyMs={inferLatencyMs}
            onStartCamera={handleStartCamera}
            onStartSimulation={() => {
              setIsSimRunning(true);
              setIsWebcamActive(false);
            }}
            onFileUpload={handleFileUpload}
          />

          <QuickControls
            candlingActive={candlingActive}
            torchActive={torchActive}
            activeSampleName={currentEgg.sampleName}
            onToggleCandling={handleToggleCandling}
            onToggleTorch={handleToggleTorch}
            onCycleAnomaly={handleCycleAnomaly}
            onCaptureSKU={handleCaptureSKU}
            isInspecting={isInspecting}
          />

          <TelemetryMatrix currentEgg={currentEgg} />
        </section>

        {/* Right Column: USDA 7 CFR Part 56 Decision Card, Lot Distribution & Logs (cols 8-12) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <GradeDecisionCard currentEgg={currentEgg} />
          <LotDistributionCard stats={stats} />
          <InspectionLogStream logs={logs} onClear={() => setLogs([])} />
        </section>
      </main>

      {/* Audit Report / COA Export Modal */}
      <COAModal
        isOpen={isCOAModalOpen}
        onClose={() => setIsCOAModalOpen(false)}
        stats={stats}
      />
    </div>
  );
}
