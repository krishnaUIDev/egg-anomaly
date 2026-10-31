import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 text-xs py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
      <p>© 2026 EggScan Enterprise Inc. Automated Computer Vision & Commercial Sorting.</p>
      <div className="flex items-center gap-4 text-[11px]">
        <span>FastAPI v2.0.0</span>
        <span>Next.js 16 Console</span>
        <span>Docker & K8s Production Ready</span>
      </div>
    </footer>
  );
}

