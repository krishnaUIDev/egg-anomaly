import React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface GradeBadgeProps {
  grade: "Grade A" | "Grade B" | "Reject" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GradeBadge({ grade, size = "md", className }: GradeBadgeProps) {
  const isGradeA = grade === "Grade A";
  const isGradeB = grade === "Grade B";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-2 text-base font-extrabold",
  }[size];

  const colorClasses = isGradeA
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : isGradeB
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-rose-500/20 text-rose-400 border-rose-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold border transition-colors",
        sizeClasses,
        colorClasses,
        className
      )}
    >
      {isGradeA ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      ) : isGradeB ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{grade}</span>
    </span>
  );
}

