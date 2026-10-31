"use client";

import React, { useEffect, useRef } from "react";
import { Camera, Video, PlayCircle, Ruler, Zap } from "lucide-react";
import { OvoEggScenario } from "../lib/types";

interface ViewfinderHUDProps {
  currentEgg: OvoEggScenario;
  isWebcamActive: boolean;
  isSimRunning: boolean;
  candlingActive: boolean;
  inferLatencyMs: number;
  onStartCamera: () => void;
  onStartSimulation: () => void;
  onFileUpload: (file: File) => void;
}

export function ViewfinderHUD({
  currentEgg,
  isWebcamActive,
  isSimRunning,
  candlingActive,
  inferLatencyMs,
  onStartCamera,
  onStartSimulation,
  onFileUpload,
}: ViewfinderHUDProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  // Canvas resize and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    }
    resize();
    window.addEventListener("resize", resize);

    function loop() {
      renderHUD();
      animFrameRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentEgg, candlingActive, isWebcamActive, isSimRunning]);

  function renderHUD() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    phaseRef.current += 0.03;
    const phase = phaseRef.current;

    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.min(w, h) * 0.28;
    const ry = rx * 1.34;

    // Draw synthesized egg when physical camera video is off
    if (!isWebcamActive) {
      drawEggBody(ctx, cx, cy, rx, ry, phase);
    }

    // Draw target brackets & detection HUD box
    const boxW = rx * 2.3;
    const boxH = ry * 2.2;
    const bx = cx - boxW / 2;
    const by = cy - boxH / 2;

    const bracketColor = currentEgg.grade === "AA"
      ? "#10b981"
      : currentEgg.grade.includes("Loss") || currentEgg.grade.includes("Inedible")
      ? "#ef4444"
      : "#f59e0b";

    ctx.strokeStyle = bracketColor;
    ctx.lineWidth = 2.5;
    const cornerLen = 24;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(bx, by + cornerLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cornerLen, by);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(bx + boxW - cornerLen, by);
    ctx.lineTo(bx + boxW, by);
    ctx.lineTo(bx + boxW, by + cornerLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(bx, by + boxH - cornerLen);
    ctx.lineTo(bx, by + boxH);
    ctx.lineTo(bx + cornerLen, by + boxH);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(bx + boxW - cornerLen, by + boxH);
    ctx.lineTo(bx + boxW, by + boxH);
    ctx.lineTo(bx + boxW, by + boxH - cornerLen);
    ctx.stroke();

    // Label pill over bounding box
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(bx, by - 24, 215, 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.fillText(
      `OBJ: GALLUS_EGG | CONF: ${(currentEgg.confidence * 100).toFixed(1)}%`,
      bx + 6,
      by - 10
    );

    // Defect Overlays
    if (currentEgg.cracksDetected) {
      drawCrackDefect(ctx, cx, cy, rx, ry);
    }

    if (currentEgg.bloodSpotDetected && candlingActive) {
      drawBloodSpotDefect(ctx, cx, cy, rx, ry);
    }

    if (currentEgg.dirtPercentage > 1.0) {
      drawDirtSpecks(ctx, cx, cy, rx, ry, currentEgg.dirtPercentage);
    }

    if (candlingActive) {
      drawAirCellRulerCanvas(ctx, cx, cy, rx, ry, currentEgg.airCellMm);
    }
  }

  function drawEggBody(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, phase: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * 1.05, cy - ry, cx + rx * 1.15, cy + ry * 0.7, cx, cy + ry);
    ctx.bezierCurveTo(cx - rx * 1.15, cy + ry * 0.7, cx - rx * 1.05, cy - ry, cx, cy - ry);
    ctx.closePath();

    if (candlingActive) {
      const grad = ctx.createRadialGradient(cx, cy + 20, 10, cx, cy, ry * 1.1);
      grad.addColorStop(0, "#fef08a");
      grad.addColorStop(0.35, "#f59e0b");
      grad.addColorStop(0.75, "#b45309");
      grad.addColorStop(1, "#451a03");
      ctx.fillStyle = grad;
      ctx.fill();

      // Candled Yolk Shadow
      const yolkShiftY = Math.sin(phase) * 6;
      const yolkGrad = ctx.createRadialGradient(cx, cy + yolkShiftY, 5, cx, cy + yolkShiftY, rx * 0.65);
      yolkGrad.addColorStop(0, "rgba(180, 83, 9, 0.9)");
      yolkGrad.addColorStop(0.7, "rgba(146, 64, 14, 0.6)");
      yolkGrad.addColorStop(1, "rgba(180, 83, 9, 0)");
      ctx.fillStyle = yolkGrad;
      ctx.beginPath();
      ctx.arc(cx, cy + yolkShiftY, rx * 0.65, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const grad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 20, cx, cy, ry * 1.2);
      grad.addColorStop(0, "#fef3c7");
      grad.addColorStop(0.4, "#fde68a");
      grad.addColorStop(0.85, "#d97706");
      grad.addColorStop(1, "#92400e");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawCrackDefect(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#dc2626";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    const startX = cx - rx * 0.4;
    const startY = cy - ry * 0.2;
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + 18, startY + 22);
    ctx.lineTo(startX + 12, startY + 44);
    ctx.lineTo(startX + 32, startY + 70);
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(startX + 38, startY + 40, 115, 18);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CRACK_CHECK: 0.88", startX + 42, startY + 52);
    ctx.restore();
  }

  function drawBloodSpotDefect(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.save();
    const bx = cx + rx * 0.22;
    const by = cy + ry * 0.08;

    ctx.fillStyle = "#991b1b";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(bx + 16, by - 12, 135, 18);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.fillText('BLOOD_SPOT > 1/8": LOSS', bx + 20, by);
    ctx.restore();
  }

  function drawDirtSpecks(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, percent: number) {
    ctx.save();
    ctx.fillStyle = "#451a03";
    const speckCoords = [
      [cx - 20, cy + 30, 4],
      [cx - 35, cy + 15, 6],
      [cx - 15, cy + 50, 7],
      [cx - 40, cy + 42, 5],
      [cx - 28, cy + 62, 3],
    ];

    speckCoords.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(cx - 140, cy + 40, 105, 18);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 9px monospace";
    ctx.fillText(`DIRT_AREA: ${percent}%`, cx - 135, cy + 52);
    ctx.restore();
  }

  function drawAirCellRulerCanvas(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, depthMm: number) {
    ctx.save();
    const topY = cy - ry;
    const cellPx = Math.max(12, depthMm * 4.2);

    ctx.strokeStyle = "#38bdf8";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.7, topY + cellPx);
    ctx.lineTo(cx + rx * 0.7, topY + cellPx);
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "9px monospace";
    ctx.fillText(`AIR CELL DEPTH: ${depthMm}mm`, cx - 55, topY + cellPx - 4);
    ctx.restore();
  }

  const isAA = currentEgg.grade === "AA";
  const isLoss = currentEgg.grade.includes("Loss") || currentEgg.grade.includes("Inedible");

  return (
    <div className="relative bg-black rounded-2xl border border-slate-700 overflow-hidden shadow-2xl aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center">
      {/* Live Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {/* Canvas Layer for AI bounding boxes & edge contours */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* Simulated Candling Filter Overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-20 mix-blend-color-dodge bg-gradient-to-t from-amber-600/30 via-orange-500/20 to-transparent ${
          candlingActive ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Air Cell Ruler Pill */}
      {candlingActive && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/85 backdrop-blur border border-amber-500/40 p-2 rounded-lg text-[11px] font-mono">
          <div className="text-amber-400 font-semibold mb-1 flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5" /> USDA Air Cell Depth
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-300">Measured:</span>
            <span className="text-white font-bold text-xs">
              {currentEgg.airCellMm} mm ({currentEgg.airCellInch})
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {currentEgg.airCellMm <= 3.2 ? 'AA ≤ 1/8"' : currentEgg.airCellMm <= 4.8 ? 'A ≤ 3/16"' : 'B > 3/16"'}
            </span>
          </div>
        </div>
      )}

      {/* Top HUD Badges & Live USDA Banner */}
      <div className="absolute inset-3 pointer-events-none z-20 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> EDGE-YOLOv9-POULTRY-v4.2
            </span>
            <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 border border-amber-500/30 w-fit">
              {candlingActive ? "MODE: TRANSILLUMINATION (CANDLING)" : "MODE: REFLECTIVE (SURFACE ONLY)"}
            </span>
          </div>

          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-lg text-sm font-black font-mono tracking-wider shadow-lg text-white border ${
                isAA
                  ? "bg-emerald-600 border-emerald-400"
                  : isLoss
                  ? "bg-rose-600 border-rose-400"
                  : "bg-amber-600 border-amber-400"
              }`}
            >
              GRADE {currentEgg.grade}
            </span>
            <div className="text-[10px] font-mono text-slate-300 mt-1 bg-black/60 px-1.5 py-0.5 rounded">
              CONF: <span className="text-emerald-400 font-bold">{(currentEgg.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Bottom HUD Stats Bar */}
        <div className="flex justify-between items-end">
          <div className="bg-black/70 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-2">
              <span>
                SHELL:{" "}
                <span className={currentEgg.cracksDetected ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                  {currentEgg.cracksDetected ? "CHECK DETECTED" : "NORMAL"}
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                CRACKS:{" "}
                <span className={currentEgg.cracksDetected ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                  {currentEgg.cracksDetected ? "FAIL" : "NONE"}
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                FOREIGN:{" "}
                <span className="text-emerald-400 font-semibold">
                  {currentEgg.dirtPercentage.toFixed(1)}%
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-black/70 px-2 py-1 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{inferLatencyMs.toFixed(1)} ms</span>
          </div>
        </div>
      </div>

      {/* Standby Fallback View */}
      {!isWebcamActive && !isSimRunning && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
            <Camera className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-slate-200 font-semibold text-base mb-1">Industrial Optical Feed Standby</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Initialize phone camera or start synthesized production conveyor line to benchmark multi-defect AI.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={onStartCamera}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-900/50 cursor-pointer"
            >
              <Video className="w-4 h-4" /> Start Phone Camera
            </button>
            <button
              onClick={onStartSimulation}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" /> Load Conveyor Simulation
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" /> Upload Snapshot
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
