/**
 * EggScan AI - Frontend Application Controller
 * Handles camera capture, file upload, sample testing, and visual feedback rendering.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const cameraInput = document.getElementById("cameraInput");
  const fileInput = document.getElementById("fileInput");
  const sampleChips = document.getElementById("sampleChips");
  const displayImage = document.getElementById("displayImage");
  const emptyPlaceholder = document.getElementById("emptyPlaceholder");
  const spinnerOverlay = document.getElementById("spinnerOverlay");
  const gradeBanner = document.getElementById("gradeBanner");
  const gradeBadge = document.getElementById("gradeBadge");
  const qualityScoreVal = document.getElementById("qualityScoreVal");
  const recommendationText = document.getElementById("recommendationText");
  const defectsContainer = document.getElementById("defectsContainer");
  const defectsList = document.getElementById("defectsList");
  const auditSummary = document.getElementById("auditSummary");
  const auditReasons = document.getElementById("auditReasons");
  const latencyTag = document.getElementById("latencyTag");
  const detectionTag = document.getElementById("detectionTag");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const crackSensitivity = document.getElementById("crackSensitivity");
  const stainSensitivity = document.getElementById("stainSensitivity");
  const crackVal = document.getElementById("crackVal");
  const stainVal = document.getElementById("stainVal");

  // State cache
  let currentInspection = null;
  let currentRawImageSrc = null;
  let activeTab = "annotated";

  // Sensitivity Sliders
  crackSensitivity.addEventListener("input", (e) => {
    crackVal.textContent = parseFloat(e.target.value).toFixed(2);
  });
  stainSensitivity.addEventListener("input", (e) => {
    stainVal.textContent = parseFloat(e.target.value).toFixed(2);
  });

  // Camera & File input triggers
  cameraInput.addEventListener("change", (e) => handleImageSelection(e.target.files[0]));
  fileInput.addEventListener("change", (e) => handleImageSelection(e.target.files[0]));

  // Benchmark Sample Chips
  sampleChips.addEventListener("click", async (e) => {
    const chip = e.target.closest(".sample-chip");
    if (!chip) return;
    const sampleFilename = chip.getAttribute("data-sample");
    await fetchAndInspectSample(sampleFilename);
  });

  // View Tab Switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-view");
      updateDisplayedImage();
    });
  });

  async function handleImageSelection(file) {
    if (!file) return;

    // Read raw preview
    const reader = new FileReader();
    reader.onload = (e) => {
      currentRawImageSrc = e.target.result;
    };
    reader.readAsDataURL(file);

    await uploadAndInspect(file);
  }

  async function fetchAndInspectSample(filename) {
    showLoading(true);
    try {
      const resp = await fetch(`/samples/${filename}`);
      if (!resp.ok) throw new Error("Failed to load sample image");
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        currentRawImageSrc = e.target.result;
      };
      reader.readAsDataURL(file);

      await uploadAndInspect(file);
    } catch (err) {
      alert("Error loading sample: " + err.message);
      showLoading(false);
    }
  }

  async function uploadAndInspect(file) {
    showLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const crackSens = crackSensitivity.value;
    const stainSens = stainSensitivity.value;
    const url = `/api/v1/inspect?crack_sensitivity=${crackSens}&stain_sensitivity=${stainSens}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${response.status}`);
      }

      const data = await response.json();
      currentInspection = data;
      renderResults(data);
    } catch (err) {
      alert("Inspection failed: " + err.message);
    } finally {
      showLoading(false);
    }
  }

  function renderResults(data) {
    emptyPlaceholder.classList.add("hidden");
    displayImage.classList.remove("hidden");

    // Meta tags
    latencyTag.textContent = `${data.processing_time_ms} ms`;
    detectionTag.textContent = `Egg: ${(data.detection_confidence * 100).toFixed(0)}%`;

    // Grade Banner
    gradeBanner.classList.remove("hidden", "grade-a", "grade-b", "grade-reject");
    let gradeClass = "grade-a";
    if (data.grade === "Reject") gradeClass = "grade-reject";
    else if (data.grade === "Grade B") gradeClass = "grade-b";

    gradeBanner.classList.add(gradeClass);
    gradeBadge.textContent = data.grade;
    qualityScoreVal.textContent = `${data.quality_score} / 100`;
    recommendationText.textContent = data.recommendation;

    // Defects list
    defectsList.innerHTML = "";
    if (data.defects && data.defects.length > 0) {
      defectsContainer.classList.remove("hidden");
      data.defects.forEach((defect) => {
        const item = document.createElement("div");
        item.className = `defect-item ${defect.defect_type}`;
        item.innerHTML = `
          <div>
            <div class="defect-title">${defect.defect_type.replace('_', ' ')}</div>
            <div class="defect-desc">${defect.description}</div>
          </div>
          <div class="defect-badge">${(defect.confidence * 100).toFixed(0)}% conf</div>
        `;
        defectsList.appendChild(item);
      });
    } else {
      defectsContainer.classList.add("hidden");
    }

    // Audit trail
    auditReasons.innerHTML = "";
    if (data.reasons && data.reasons.length > 0) {
      auditSummary.classList.remove("hidden");
      data.reasons.forEach((reason) => {
        const li = document.createElement("li");
        li.textContent = reason;
        auditReasons.appendChild(li);
      });
    } else {
      auditSummary.classList.add("hidden");
    }

    // Default to annotated view
    activeTab = "annotated";
    tabButtons.forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-view") === "annotated");
    });
    updateDisplayedImage();
  }

  function updateDisplayedImage() {
    if (!currentInspection) return;

    if (activeTab === "annotated") {
      displayImage.src = currentInspection.annotated_image_data || currentRawImageSrc;
    } else if (activeTab === "heatmap") {
      displayImage.src = currentInspection.heatmap_data || currentInspection.annotated_image_data;
    } else {
      displayImage.src = currentRawImageSrc || currentInspection.annotated_image_data;
    }
  }

  function showLoading(isLoading) {
    if (isLoading) {
      spinnerOverlay.classList.remove("hidden");
    } else {
      spinnerOverlay.classList.add("hidden");
    }
  }
});

