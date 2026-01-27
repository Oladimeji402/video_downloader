/**
 * VideoFramer Frontend
 * Handles video URL resolution, preview, frame selection, and download
 */

// ===========================================
// Configuration
// ===========================================
const API_BASE = "http://localhost:4000/api";
const POLL_INTERVAL = 1000; // 1 second

// ===========================================
// DOM Elements
// ===========================================
const elements = {
  // Input section
  videoUrl: document.getElementById("videoUrl"),
  actionBtn: document.getElementById("actionBtn"),
  previewBtn: document.getElementById("previewBtn"),
  fetchStatus: document.getElementById("fetchStatus"),
  fetchStatusText: document.getElementById("fetchStatusText"),
  fetchProgress: document.getElementById("fetchProgress"),

  // Preview section
  previewSection: document.getElementById("previewSection"),
  framePreview: document.getElementById("framePreview"),
  videoPlayer: document.getElementById("videoPlayer"),
  frameOverlay: document.getElementById("frameOverlay"),
  frameOptions: document.getElementById("frameOptions"),
  noFramesMsg: document.getElementById("noFramesMsg"),

  // Download section
  downloadSection: document.getElementById("downloadSection"),
  downloadBtn: document.getElementById("downloadBtn"),
  renderStatus: document.getElementById("renderStatus"),
  renderStatusText: document.getElementById("renderStatusText"),
  renderProgress: document.getElementById("renderProgress"),

  // Toast container
  toastContainer: document.getElementById("toastContainer"),
};

// ===========================================
// State
// ===========================================
let state = {
  videoId: null,
  selectedFrame: "none",
  frames: [],
  isProcessing: false,
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Update button state based on input
 */
function updateActionButton() {
  const hasValue = elements.videoUrl.value.trim().length > 0;
  const btn = elements.actionBtn;
  
  if (hasValue) {
    btn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      <span>Clear</span>
    `;
  } else {
    btn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Paste</span>
    `;
  }
}

/**
 * Set loading state for a button
 */
function setButtonLoading(btn, loading, originalContent = null) {
  if (loading) {
    btn.dataset.originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <div class="spinner"></div>
      <span>Processing...</span>
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalContent || btn.dataset.originalContent || "Button";
  }
}

/**
 * Poll for status updates
 */
async function pollStatus(endpoint, statusEl, textEl, progressEl, onComplete, onError) {
  let pollCount = 0;
  const maxPolls = 300; // 5 minutes max

  const poll = async () => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Unknown error");
      }

      // Update progress
      if (progressEl && data.progress !== undefined) {
        progressEl.style.width = `${data.progress}%`;
      }

      if (textEl) {
        textEl.textContent = `${data.status === "downloading" ? "Downloading" : "Processing"}... ${Math.round(data.progress || 0)}%`;
      }

      if (data.status === "completed") {
        statusEl.classList.add("hidden");
        onComplete(data);
        return;
      }

      if (data.status === "failed") {
        statusEl.classList.add("hidden");
        onError(new Error(data.error || "Processing failed"));
        return;
      }

      // Continue polling
      pollCount++;
      if (pollCount < maxPolls) {
        setTimeout(poll, POLL_INTERVAL);
      } else {
        statusEl.classList.add("hidden");
        onError(new Error("Timeout: Processing took too long"));
      }
    } catch (err) {
      statusEl.classList.add("hidden");
      onError(err);
    }
  };

  statusEl.classList.remove("hidden");
  poll();
}

// ===========================================
// Frame Management
// ===========================================

/**
 * Load available frames from API
 */
async function loadFrames() {
  try {
    const response = await fetch(`${API_BASE}/frames`);
    const data = await response.json();

    if (data.success && data.frames.length > 0) {
      state.frames = data.frames;
      renderFrameOptions();
      elements.noFramesMsg.classList.add("hidden");
    } else {
      elements.noFramesMsg.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Failed to load frames:", err);
    elements.noFramesMsg.classList.remove("hidden");
  }
}

/**
 * Render frame selection options
 */
function renderFrameOptions() {
  // Keep the "No Frame" option
  const noFrameOption = elements.frameOptions.querySelector('[data-frame="none"]');
  elements.frameOptions.innerHTML = "";
  
  if (noFrameOption) {
    elements.frameOptions.appendChild(noFrameOption);
  }

  // Add available frames
  state.frames.forEach((frame) => {
    const option = document.createElement("button");
    option.className = "frame-option";
    option.dataset.frame = frame.id;
    option.innerHTML = `
      <div class="frame-thumb">
        <img src="${API_BASE}${frame.path}" alt="${frame.name}" />
      </div>
      <span>${frame.name}</span>
    `;
    option.addEventListener("click", () => selectFrame(frame.id));
    elements.frameOptions.appendChild(option);
  });
}

/**
 * Select a frame
 */
function selectFrame(frameId) {
  state.selectedFrame = frameId;

  // Update UI
  document.querySelectorAll(".frame-option").forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.frame === frameId);
  });

  // Update preview overlay
  updateFramePreview(frameId);
}

/**
 * Update frame preview overlay
 */
function updateFramePreview(frameId) {
  const overlay = elements.frameOverlay;
  const preview = elements.framePreview;

  // Reset
  overlay.style.backgroundImage = "";
  preview.removeAttribute("data-frame");

  if (frameId === "none") {
    return;
  }

  // Check if it's a custom CSS frame or an image frame
  const cssFrames = ["blue", "gold", "neon", "gradient"];
  
  if (cssFrames.includes(frameId)) {
    preview.setAttribute("data-frame", frameId);
  } else {
    // Image frame
    const frame = state.frames.find((f) => f.id === frameId);
    if (frame) {
      overlay.style.backgroundImage = `url(${API_BASE}${frame.path})`;
    }
  }
}

// ===========================================
// Video Operations
// ===========================================

/**
 * Fetch and preview video from URL
 */
async function fetchVideo() {
  const url = elements.videoUrl.value.trim();

  if (!url) {
    showToast("Please paste a video URL first", "warning");
    return;
  }

  state.isProcessing = true;
  setButtonLoading(elements.previewBtn, true);
  elements.fetchProgress.style.width = "0%";

  try {
    // Start the download
    const response = await fetch(`${API_BASE}/video/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to start download");
    }

    state.videoId = data.videoId;
    elements.fetchStatusText.textContent = "Fetching video...";

    // Poll for download status
    pollStatus(
      `/video/status/${data.videoId}`,
      elements.fetchStatus,
      elements.fetchStatusText,
      elements.fetchProgress,
      // On complete
      () => {
        showVideoPreview();
        showToast("Video loaded successfully!", "success");
        state.isProcessing = false;
        setButtonLoading(elements.previewBtn, false, `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Fetch & Preview</span>
        `);
      },
      // On error
      (err) => {
        showToast(err.message || "Failed to download video", "error");
        state.isProcessing = false;
        setButtonLoading(elements.previewBtn, false, `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Fetch & Preview</span>
        `);
      }
    );
  } catch (err) {
    console.error("Fetch error:", err);
    showToast(err.message || "Failed to connect to server", "error");
    state.isProcessing = false;
    setButtonLoading(elements.previewBtn, false);
    elements.fetchStatus.classList.add("hidden");
  }
}

/**
 * Show video preview
 */
function showVideoPreview() {
  elements.videoPlayer.src = `${API_BASE}/video/preview/${state.videoId}?t=${Date.now()}`;
  elements.videoPlayer.load();
  
  elements.previewSection.classList.remove("hidden");
  elements.downloadSection.classList.remove("hidden");

  // Scroll to preview
  elements.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Download framed video
 */
async function downloadVideo() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // If no frame selected, just download the original
  if (state.selectedFrame === "none") {
    downloadOriginalVideo();
    return;
  }

  state.isProcessing = true;
  setButtonLoading(elements.downloadBtn, true);
  elements.renderProgress.style.width = "0%";

  try {
    // Start the render
    const response = await fetch(`${API_BASE}/video/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: state.videoId,
        frameId: state.selectedFrame,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to start render");
    }

    elements.renderStatusText.textContent = "Rendering video...";

    // Poll for render status
    pollStatus(
      `/video/render/${data.jobId}`,
      elements.renderStatus,
      elements.renderStatusText,
      elements.renderProgress,
      // On complete
      () => {
        // Trigger download
        triggerDownload(`${API_BASE}/video/download/${data.jobId}`);
        showToast("Video rendered! Download starting...", "success");
        state.isProcessing = false;
        setButtonLoading(elements.downloadBtn, false, `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Framed Video</span>
        `);
      },
      // On error
      (err) => {
        showToast(err.message || "Failed to render video", "error");
        state.isProcessing = false;
        setButtonLoading(elements.downloadBtn, false, `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Framed Video</span>
        `);
      }
    );
  } catch (err) {
    console.error("Render error:", err);
    showToast(err.message || "Failed to connect to server", "error");
    state.isProcessing = false;
    setButtonLoading(elements.downloadBtn, false);
    elements.renderStatus.classList.add("hidden");
  }
}

/**
 * Download original video without frame
 */
async function downloadOriginalVideo() {
  setButtonLoading(elements.downloadBtn, true);

  try {
    const response = await fetch(`${API_BASE}/video/preview/${state.videoId}`);
    
    if (!response.ok) {
      throw new Error("Failed to download video");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast("Download started!", "success");
  } catch (err) {
    console.error("Download error:", err);
    showToast("Failed to download video", "error");
  } finally {
    setButtonLoading(elements.downloadBtn, false, `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download Framed Video</span>
    `);
  }
}

/**
 * Trigger file download from URL
 */
function triggerDownload(url) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `framed-video-${Date.now()}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ===========================================
// Event Listeners
// ===========================================

// Paste/Clear button
elements.actionBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (elements.videoUrl.value.trim()) {
    elements.videoUrl.value = "";
    // Reset state
    state.videoId = null;
    state.selectedFrame = "none";
    elements.previewSection.classList.add("hidden");
    elements.downloadSection.classList.add("hidden");
  } else {
    try {
      const text = await navigator.clipboard.readText();
      elements.videoUrl.value = text;
    } catch (err) {
      showToast("Unable to access clipboard", "error");
    }
  }

  updateActionButton();
});

// URL input changes
elements.videoUrl.addEventListener("input", updateActionButton);

// Enter key in URL input
elements.videoUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!state.isProcessing) {
      fetchVideo();
    }
  }
});

// Preview button
elements.previewBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!state.isProcessing) {
    fetchVideo();
  }
});

// Download button
elements.downloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!state.isProcessing) {
    downloadVideo();
  }
});

// Frame selection (delegated)
elements.frameOptions.addEventListener("click", (e) => {
  const option = e.target.closest(".frame-option");
  if (option && option.dataset.frame) {
    selectFrame(option.dataset.frame);
  }
});

// ===========================================
// Initialize
// ===========================================

document.addEventListener("DOMContentLoaded", () => {
  updateActionButton();
  loadFrames();
});
