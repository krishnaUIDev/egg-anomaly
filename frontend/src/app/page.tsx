"use client";

import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { InspectionStudio } from "../components/InspectionStudio";
import { BatchQC } from "../components/BatchQC";
import { AnalyticsDashboard } from "../components/AnalyticsDashboard";
import { Footer } from "../components/Footer";

import {
  ActiveTab,
  InspectionResult,
  BatchSummary,
  EnterpriseMetrics,
  ViewLayer,
} from "../lib/types";
import {
  inspectSingleEgg,
  inspectBatchEggs,
  fetchEnterpriseMetrics,
  fetchSampleImageFile,
} from "../lib/api";

export default function EggScanDashboard() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>("single");

  // Single Inspection State
  const [singleResult, setSingleResult] = useState<InspectionResult | null>(null);
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [viewLayer, setViewLayer] = useState<ViewLayer>("annotated");
  const [isSingleLoading, setIsSingleLoading] = useState(false);

  // Calibration Parameters
  const [crackSensitivity, setCrackSensitivity] = useState(0.5);
  const [stainSensitivity, setStainSensitivity] = useState(0.5);

  // Batch QC State
  const [batchResult, setBatchResult] = useState<BatchSummary | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Enterprise Telemetry State
  const [metrics, setMetrics] = useState<EnterpriseMetrics | null>(null);
  const [systemHealthy, setSystemHealthy] = useState(true);

  // Load telemetry metrics periodically
  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      const data = await fetchEnterpriseMetrics();
      setMetrics(data);
      setSystemHealthy(true);
    } catch {
      setSystemHealthy(false);
    }
  }

  // Handle Single File Upload or Camera Capture
  async function handleSingleFile(file: File) {
    if (!file) return;
    setIsSingleLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => setRawPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const result = await inspectSingleEgg(file, crackSensitivity, stainSensitivity);
      setSingleResult(result);
      setViewLayer("annotated");
      loadMetrics();
    } catch (err: any) {
      alert("Error inspecting egg: " + err.message);
    } finally {
      setIsSingleLoading(false);
    }
  }

  // Handle Quick Test Sample Click
  async function handleSampleSelect(filename: string) {
    setIsSingleLoading(true);
    try {
      const file = await fetchSampleImageFile(filename);
      await handleSingleFile(file);
    } catch (err: any) {
      alert("Sample loading failed: " + err.message);
      setIsSingleLoading(false);
    }
  }

  // Handle Multi-file Batch Upload
  async function handleBatchFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsBatchLoading(true);

    try {
      const summary = await inspectBatchEggs(files, crackSensitivity, stainSensitivity);
      setBatchResult(summary);
      loadMetrics();
    } catch (err: any) {
      alert("Batch inspection failed: " + err.message);
    } finally {
      setIsBatchLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation & Status */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemHealthy={systemHealthy}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "single" && (
          <InspectionStudio
            result={singleResult}
            rawPreview={rawPreview}
            viewLayer={viewLayer}
            onLayerChange={setViewLayer}
            isLoading={isSingleLoading}
            onSelectFile={handleSingleFile}
            onSelectSample={handleSampleSelect}
            crackSensitivity={crackSensitivity}
            stainSensitivity={stainSensitivity}
            onCrackChange={setCrackSensitivity}
            onStainChange={setStainSensitivity}
          />
        )}

        {activeTab === "batch" && (
          <BatchQC
            batchResult={batchResult}
            isLoading={isBatchLoading}
            onUploadBatch={handleBatchFiles}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsDashboard
            metrics={metrics}
            onRefresh={loadMetrics}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
