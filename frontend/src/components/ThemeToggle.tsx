"use client";

import React, { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): ThemeMode {
  try {
    const stored = localStorage.getItem("color-scheme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Ignore
  }
  return "system";
}

function getServerSnapshot(): ThemeMode {
  return "system";
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (mode === "system") {
    if (meta) meta.content = "light dark";
    document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.removeItem("color-scheme");
    } catch {
      // Ignore
    }
  } else {
    if (meta) meta.content = mode;
    document.documentElement.setAttribute("data-theme", mode);
    try {
      localStorage.setItem("color-scheme", mode);
    } catch {
      // Ignore
    }
  }
}

export function ThemeToggle() {
  const currentTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function handleSelect(mode: ThemeMode) {
    applyTheme(mode);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color scheme selection">
      <button
        type="button"
        className={`theme-btn ${currentTheme === "light" ? "active" : ""}`}
        onClick={() => handleSelect("light")}
        title="Light theme"
        aria-label="Switch to light theme"
        aria-pressed={currentTheme === "light"}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span className="theme-btn-label">Light</span>
      </button>

      <button
        type="button"
        className={`theme-btn ${currentTheme === "dark" ? "active" : ""}`}
        onClick={() => handleSelect("dark")}
        title="Dark theme"
        aria-label="Switch to dark theme"
        aria-pressed={currentTheme === "dark"}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span className="theme-btn-label">Dark</span>
      </button>

      <button
        type="button"
        className={`theme-btn ${currentTheme === "system" ? "active" : ""}`}
        onClick={() => handleSelect("system")}
        title="Follow system theme"
        aria-label="Follow system theme"
        aria-pressed={currentTheme === "system"}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span className="theme-btn-label">System</span>
      </button>
    </div>
  );
}
