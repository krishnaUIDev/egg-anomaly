import React from "react";
import { Sliders } from "lucide-react";

interface SensitivityControlsProps {
  crackSensitivity: number;
  stainSensitivity: number;
  onCrackChange: (val: number) => void;
  onStainChange: (val: number) => void;
}

export function SensitivityControls({
  crackSensitivity,
  stainSensitivity,
  onCrackChange,
  onStainChange,
}: SensitivityControlsProps) {
  return (
    <div className="border-t border-slate-800/80 pt-4 mt-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-3">
        <span className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-sky-400" /> Defect Sensitivity Calibration
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <label htmlFor="crack-slider">Crack Sensitivity:</label>
            <span className="font-mono text-sky-400 font-bold">{crackSensitivity.toFixed(2)}</span>
          </div>
          <input
            id="crack-slider"
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={crackSensitivity}
            onChange={(e) => onCrackChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <label htmlFor="stain-slider">Stain & Dirt Sensitivity:</label>
            <span className="font-mono text-sky-400 font-bold">{stainSensitivity.toFixed(2)}</span>
          </div>
          <input
            id="stain-slider"
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={stainSensitivity}
            onChange={(e) => onStainChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>
    </div>
  );
}
