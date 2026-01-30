/**
 * VideoFramer Frontend
 * Handles video URL resolution, preview, frame selection, and download
 */

// ===========================================
// Configuration
// ===========================================
// Auto-detect API base URL (works for localhost and production)
const API_BASE = window.location.origin + "/api";
const POLL_INTERVAL = 1000; // 1 second

// ===========================================
// DOM Elements
// ===========================================
const elements = {
  // Tab navigation
  urlTab: document.getElementById("urlTab"),
  uploadTab: document.getElementById("uploadTab"),
  
  // Input section
  videoUrl: document.getElementById("videoUrl"),
  actionBtn: document.getElementById("actionBtn"),
  previewBtn: document.getElementById("previewBtn"),
  
  // File upload
  uploadArea: document.getElementById("uploadArea"),
  uploadFileBtn: document.getElementById("uploadFileBtn"),
  fileInput: document.getElementById("fileInput"),
  
  // Fetch status
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

  // Share buttons
  shareBtn: document.getElementById("shareBtn"),
  whatsappBtn: document.getElementById("whatsappBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),

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
  lastRenderedJobId: null,
  lastRenderedUrl: null,
  isAutoRenderInProgress: false, // NEW: Prevent duplicate auto-renders
  pendingRenderKey: null, // Prevent duplicate render requests
};

// ===========================================
// URL Validation Helper
// ===========================================
const VALID_DOMAINS = [
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "facebook.com",
  "fb.watch"
];

function isValidSocialUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return VALID_DOMAINS.some(domain => url.includes(domain));
}

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
    `;
    btn.title = "Clear";
  } else {
    btn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    btn.title = "Paste from clipboard";
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
      
      // Pre-select first frame for better UX (users usually want a frame)
      // This means render will start automatically when video loads
      if (state.frames.length > 0) {
        state.selectedFrame = state.frames[0].id;
        // Update UI to show selection
        setTimeout(() => {
          const firstFrameOption = document.querySelector(`[data-frame="${state.frames[0].id}"]`);
          if (firstFrameOption) {
            document.querySelectorAll(".frame-option").forEach(opt => opt.classList.remove("selected"));
            firstFrameOption.classList.add("selected");
          }
        }, 100);
      }
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
        <img src="${window.location.origin}${frame.path}" alt="${frame.name}" />
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
  console.log("Selecting frame:", frameId);
  
  // If selecting same frame, do nothing
  if (state.selectedFrame === frameId) {
    return;
  }
  
  state.selectedFrame = frameId;
  
  // Reset rendered state when changing frames
  state.lastRenderedJobId = null;
  state.lastRenderedUrl = null;
  
  // Cancel any in-progress render for the OLD frame
  // by clearing the flags - the completion handler will check if frame changed
  state.isAutoRenderInProgress = false;
  state.pendingRenderKey = null;
  
  // Hide any existing render indicator (old render is now stale)
  const indicator = document.getElementById("renderIndicator");
  if (indicator) {
    indicator.style.display = "none";
  }

  // Update UI
  document.querySelectorAll(".frame-option").forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.frame === frameId);
  });

  // Update preview overlay
  updateFramePreview(frameId);

  // Auto-start rendering in background if frame is selected and video is loaded
  if (frameId !== "none" && state.videoId) {
    console.log("Auto-starting render for selected frame:", frameId);
    autoStartRenderForFrame(frameId);
  }
}

/**
 * Update frame preview overlay
 */
function updateFramePreview(frameId) {
  console.log("Updating preview for frame:", frameId);
  const overlay = elements.frameOverlay;
  const preview = elements.framePreview;

  // Reset completely
  overlay.style.backgroundImage = "";
  overlay.style.backgroundColor = "";
  overlay.classList.remove("visible");
  preview.removeAttribute("data-frame");

  if (frameId === "none") {
    console.log("No frame selected");
    return;
  }

  // Check if it's a custom CSS frame or an image frame
  const cssFrames = ["blue", "gold", "neon", "gradient"];
  
  if (cssFrames.includes(frameId)) {
    console.log("CSS frame:", frameId);
    preview.setAttribute("data-frame", frameId);
    overlay.classList.add("visible");
  } else {
    // Image frame - show it over the video
    const frame = state.frames.find((f) => f.id === frameId);
    if (frame) {
      console.log("Image frame found:", frame);
      // Encode the URL to handle spaces and special characters
      const imageUrl = `${window.location.origin}${encodeURI(frame.path)}`;
      console.log("Loading frame image from:", imageUrl);
      
      // Set background image
      overlay.style.backgroundImage = `url("${imageUrl}")`;
      overlay.classList.add("visible");
      
      console.log("Frame overlay class added: visible");
      console.log("Overlay classList:", overlay.classList);
    } else {
      console.log("Frame not found in state.frames:", frameId);
    }
  }
}

/**
 * Auto-start rendering when a frame is selected
 * This ensures the framed video is ready when user clicks Share
 */
async function autoStartRenderForFrame(frameId) {
  // Create unique key for this render request
  const renderKey = `${state.videoId}-${frameId}`;
  
  // If already rendering this exact combination, skip
  if (state.pendingRenderKey === renderKey) {
    console.log("Same render already in progress, skipping");
    return;
  }
  
  // If already rendered this frame, don't start again
  if (state.lastRenderedJobId && state.selectedFrame === frameId) {
    console.log("Frame already rendered, skipping auto-render");
    return;
  }

  // If auto-render is already in progress, don't start another
  if (state.isAutoRenderInProgress) {
    console.log("Auto-render already in progress, skipping");
    return;
  }

  // Don't auto-render during downloads or other processing
  if (state.isProcessing) {
    console.log("Processing in progress, skipping auto-render");
    return;
  }

  // Mark as in progress to prevent duplicates
  state.isAutoRenderInProgress = true;
  state.pendingRenderKey = renderKey;

  try {
    console.log("Starting auto-render for frame:", frameId);
    showToast("Preparing framed video...", "info");
    
    // Show a subtle render indicator (top of download section)
    const renderIndicator = document.getElementById("renderIndicator") || createRenderIndicator();
    renderIndicator.style.display = "flex";
    
    // Start the render with retry logic for 429
    let retryCount = 0;
    const maxRetries = 3;
    let response;

    while (retryCount < maxRetries) {
      try {
        response = await fetch(`${API_BASE}/video/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: state.videoId,
            frameId: frameId,
          }),
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          retryCount++;
          if (retryCount < maxRetries) {
            const delayMs = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            console.warn(`Rate limited (429). Retrying in ${delayMs}ms (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue; // Retry
          } else {
            throw new Error("Too many requests. Server is busy. Please try again in a moment.");
          }
        }

        // Success or other error - break retry loop
        break;
      } catch (fetchErr) {
        if (retryCount < maxRetries - 1) {
          console.warn(`Fetch error, retrying... ${fetchErr.message}`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw fetchErr;
        }
      }
    }

    if (!response.ok) {
      throw new Error(`Render request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("Auto-render started:", data);

    if (!data.success) {
      throw new Error(data.error || "Failed to start render");
    }

    // Poll for completion - but track which frame this render is for
    const renderingForFrame = frameId;
    
    pollRenderJob(data.jobId)
      .then((jobId) => {
        // IMPORTANT: Only accept result if user hasn't switched frames
        if (state.selectedFrame !== renderingForFrame) {
          console.log(`Render completed for ${renderingForFrame} but user switched to ${state.selectedFrame}, ignoring`);
          state.isAutoRenderInProgress = false;
          state.pendingRenderKey = null;
          return;
        }
        
        console.log("Auto-render completed, jobId:", jobId);
        state.lastRenderedJobId = jobId;
        state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;
        state.isAutoRenderInProgress = false;
        state.pendingRenderKey = null;
        
        // Hide render indicator
        const indicator = document.getElementById("renderIndicator");
        if (indicator) {
          indicator.style.display = "none";
        }
        
        showToast("Framed video ready!", "success");
      })
      .catch((err) => {
        console.error("Auto-render failed:", err);
        state.isAutoRenderInProgress = false;
        state.pendingRenderKey = null;
        showToast(err.message || "Frame preparation failed (original will be shared)", "warning");
        
        // Hide render indicator
        const indicator = document.getElementById("renderIndicator");
        if (indicator) {
          indicator.style.display = "none";
        }
      });

  } catch (err) {
    console.error("Auto-render error:", err);
    state.isAutoRenderInProgress = false;
    state.pendingRenderKey = null;
    showToast(err.message || "Frame preparation failed", "warning");
    
    // Hide render indicator
    const indicator = document.getElementById("renderIndicator");
    if (indicator) {
      indicator.style.display = "none";
    }
  }
}

/**
 * Create a subtle render progress indicator
 */
function createRenderIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "renderIndicator";
  indicator.style.cssText = `
    display: none;
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #007AFF, #34C759);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    z-index: 9999;
    animation: slideInUp 0.3s ease-out;
  `;
  
  indicator.innerHTML = `
    <div style="width: 12px; height: 12px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <span>Preparing frame...</span>
  `;
  
  document.body.appendChild(indicator);
  
  // Inject animation if not already present
  if (!document.getElementById("renderIndicatorStyles")) {
    const style = document.createElement("style");
    style.id = "renderIndicatorStyles";
    style.textContent = `
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  return indicator;
}

/**
 * Update frame preview overlay
 */

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

    if (!data.videoId) {
      throw new Error("No videoId returned from server");
    }

    state.videoId = data.videoId;
    console.log("Download started, videoId:", state.videoId);
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
  // Validate videoId exists
  if (!state.videoId) {
    console.error("Error: videoId is not set");
    showToast("Error: Video ID missing", "error");
    return;
  }

  const videoUrl = `${API_BASE}/video/preview/${state.videoId}?t=${Date.now()}`;
  
  console.log("Loading video from:", videoUrl);
  console.log("API_BASE:", API_BASE);
  console.log("videoId:", state.videoId);
  
  // Clear and reset video player completely
  elements.videoPlayer.innerHTML = "";
  
  // Create source element properly
  const sourceEl = document.createElement("source");
  sourceEl.src = videoUrl;
  sourceEl.type = "video/mp4";
  
  // Append source to video element
  elements.videoPlayer.appendChild(sourceEl);
  
  // Set load behavior
  elements.videoPlayer.preload = "metadata";
  elements.videoPlayer.load();
  
  console.log("Video player HTML:", elements.videoPlayer.outerHTML);
  
  // Add error handler for video playback issues
  elements.videoPlayer.onerror = async (e) => {
    const error = elements.videoPlayer.error;
    let errorMsg = "Failed to load video";
    
    if (error) {
      console.error("Video error code:", error.code, "message:", error.message);
      switch(error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMsg = "Video loading aborted";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMsg = "Network error loading video";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMsg = "Video codec not supported or file corrupted";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Video format not supported";
          break;
        default:
          errorMsg = `Video error (code ${error.code})`;
      }
    }
    
    // Get debug info
    try {
      const debugRes = await fetch(`${API_BASE}/video/debug/${state.videoId}`);
      const debugData = await debugRes.json();
      console.error("Debug info:", debugData);
      console.error("Expected URL:", videoUrl);
    } catch (err) {
      console.error("Failed to fetch debug info:", err);
    }
    
    showToast(errorMsg + ". Check console for details.", "error");
  };
  
  elements.previewSection.classList.remove("hidden");
  elements.downloadSection.classList.remove("hidden");

  // Scroll to preview
  setTimeout(() => {
    elements.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
  
  // Auto-start rendering if a frame is already selected (from pre-selection)
  // This ensures framed video is ready by the time user clicks Share
  if (state.selectedFrame && state.selectedFrame !== "none") {
    console.log("Video loaded with frame pre-selected, starting auto-render:", state.selectedFrame);
    updateFramePreview(state.selectedFrame);
    autoStartRenderForFrame(state.selectedFrame);
  }
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
        // Store the rendered video info for sharing
        state.lastRenderedJobId = data.jobId;
        state.lastRenderedUrl = `${API_BASE}/video/download/${data.jobId}`;
        
        // Trigger download
        triggerDownload(state.lastRenderedUrl);
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

/**
 * Share video using Web Share API with in-memory Blob
 * IMPROVED: Shares immediately without blocking on render
 * - If rendered video available: share it
 * - If not: share original and render in background for next time
 */
async function shareVideo() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // Determine which video to share NOW (don't wait for render)
  // Priority: rendered version > original
  let videoUrl;
  let isRenderedVersion = false;
  
  if (state.lastRenderedJobId && state.selectedFrame !== "none") {
    // Rendered version available - use it
    videoUrl = state.lastRenderedUrl;
    isRenderedVersion = true;
  } else {
    // Use original - share immediately, don't block
    videoUrl = `${API_BASE}/video/preview/${state.videoId}`;
  }

  // Show brief loading (just for fetch, not render)
  showShareLoadingModal(false);

  try {
    // Fetch video blob quickly
    console.log("Fetching video for sharing:", videoUrl);
    const response = await fetch(videoUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    let blob = await response.blob();
    console.log(`Video blob fetched: ${blob.size} bytes`);

    if (blob.size === 0) {
      throw new Error("Video blob is empty");
    }

    // Close modal before sharing (share sheet will appear)
    closeShareLoadingModal();

    // Share IMMEDIATELY - don't wait for anything
    await shareBlob(blob);
    
    // If frame selected but not rendered, start render in background for NEXT share
    if (state.selectedFrame !== "none" && !state.lastRenderedJobId && !state.isAutoRenderInProgress) {
      console.log("Starting background render for next share...");
      renderVideoInBackground().then((renderedJobId) => {
        if (renderedJobId) {
          console.log("Background render completed, ready for next share:", renderedJobId);
          state.lastRenderedJobId = renderedJobId;
          state.lastRenderedUrl = `${API_BASE}/video/download/${renderedJobId}`;
          showToast("Framed version ready for next share!", "success");
        }
      }).catch((err) => {
        console.error("Background render failed:", err);
        // Don't show error - user already shared successfully
      });
    }

  } catch (err) {
    console.error("Share error:", err);
    closeShareLoadingModal();
    showToast(err.message || "Unable to share video", "error");
  }
}

/**
 * Share a Blob using native Web Share API
 * Must be called within a user gesture context
 */
async function shareBlob(blob) {
  // Check if Web Share API is supported
  if (!navigator.share || !navigator.canShare) {
    throw new Error("Share API not supported on this device");
  }

  try {
    const file = new File([blob], `framed-video-${Date.now()}.mp4`, {
      type: "video/mp4",
    });

    const shareData = {
      files: [file],
      title: "My Framed Video",
      text: "Check out my framed video!",
    };

    // Validate that we can share this data
    if (!navigator.canShare(shareData)) {
      throw new Error("Cannot share video files on this device");
    }

    // Share immediately - this opens the native share sheet
    await navigator.share(shareData);
    showToast("Video shared successfully!", "success");
    console.log("Video shared via Web Share API");

  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Share cancelled by user");
      // Don't show error toast for user cancellation
      return;
    }
    throw err;
  }
}

/**
 * Render video in background without blocking user gesture
 * Returns the jobId when complete
 */
async function renderVideoInBackground() {
  if (!state.videoId || state.selectedFrame === "none") {
    return null;
  }

  try {
    console.log("Starting background render...");
    // Start the render
    const response = await fetch(`${API_BASE}/video/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: state.videoId,
        frameId: state.selectedFrame,
      }),
    });

    if (!response.ok) {
      throw new Error(`Render request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("Render started:", data);

    if (!data.success) {
      throw new Error(data.error || "Failed to start render");
    }

    const jobId = data.jobId;
    console.log("Polling for job:", jobId);

    // Poll for render completion
    return pollRenderJob(jobId);

  } catch (err) {
    console.error("Background render error:", err);
    throw err;
  }
}

/**
 * Poll for render job completion
 */
async function pollRenderJob(jobId) {
  let pollCount = 0;
  const maxPolls = 300; // 5 minutes max
  let pollDelay = 2000; // Start with 2 seconds

  while (pollCount < maxPolls) {
    await new Promise(resolve => setTimeout(resolve, pollDelay));
    
    try {
      const statusResponse = await fetch(`${API_BASE}/video/render/${jobId}`);
      
      // Handle rate limiting
      if (statusResponse.status === 429) {
        pollDelay = Math.min(pollDelay * 2, 30000);
        console.warn(`Rate limited. Next poll in ${pollDelay}ms`);
        pollCount++;
        continue;
      }

      if (!statusResponse.ok) {
        throw new Error(`Status check failed with status ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      
      if (!statusData.success) {
        throw new Error(statusData.error || "Render failed");
      }

      // Reset poll delay on successful response
      if (pollDelay > 2000) {
        pollDelay = 2000;
      }

      if (statusData.status === "completed") {
        console.log("Render completed successfully!");
        return jobId;
      }

      if (statusData.status === "failed") {
        throw new Error(statusData.error || "Render job failed");
      }

      // Still processing - continue polling
      pollCount++;

    } catch (pollErr) {
      console.error(`Poll error: ${pollErr.message}`);
      pollCount++;
      if (pollCount >= maxPolls) {
        throw new Error("Render timeout after 5 minutes");
      }
    }
  }

  throw new Error("Render timeout after 5 minutes");
}

/**
 * Show loading modal for share operation
 */
function showShareLoadingModal(showRenderProgress = false) {
  // Create modal HTML
  const modalHtml = `
    <div class="share-modal-overlay" id="shareModalOverlay">
      <div class="share-modal">
        <div class="share-modal-content">
          <div class="share-spinner-large"></div>
          <h3 class="share-modal-title">Preparing Video</h3>
          <p class="share-modal-text" id="shareModalText">
            ${showRenderProgress 
              ? "Rendering with frame..." 
              : "Opening share options..."
            }
          </p>
          ${showRenderProgress 
            ? '<div class="share-modal-progress"><div class="share-modal-progress-bar" id="shareModalProgressBar"></div></div>'
            : ''
          }
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if present
  const existingModal = document.getElementById("shareModalOverlay");
  if (existingModal) {
    existingModal.remove();
  }

  // Insert modal into DOM
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Add styles if not already present
  if (!document.getElementById("shareModalStyles")) {
    const style = document.createElement("style");
    style.id = "shareModalStyles";
    style.textContent = `
      .share-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
      }

      .share-modal {
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 320px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .share-modal-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .share-spinner-large {
        width: 48px;
        height: 48px;
        border: 4px solid #f0f0f0;
        border-top-color: #007AFF;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .share-modal-title {
        font-size: 18px;
        font-weight: 600;
        color: #000;
        margin: 0;
      }

      .share-modal-text {
        font-size: 14px;
        color: #666;
        margin: 0;
      }

      .share-modal-progress {
        width: 100%;
        height: 4px;
        background: #f0f0f0;
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
      }

      .share-modal-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #007AFF, #34C759);
        width: 0%;
        transition: width 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Close share loading modal
 */
function closeShareLoadingModal() {
  const modal = document.getElementById("shareModalOverlay");
  if (modal) {
    modal.style.animation = "slideUp 0.3s ease-out reverse";
    setTimeout(() => modal.remove(), 300);
  }
}

/**
 * Update share modal with rendered video once ready
 */
async function updateShareModalWithRenderedVideo() {
  const modal = document.getElementById("shareModalOverlay");
  if (!modal) return;

  const textEl = document.getElementById("shareModalText");
  const progressBar = document.getElementById("shareModalProgressBar");

  try {
    if (textEl) {
      textEl.textContent = "Render complete! Fetching optimized version...";
    }

    // Fetch the rendered video
    const renderedUrl = state.lastRenderedUrl;
    const response = await fetch(renderedUrl);
    
    if (!response.ok) {
      throw new Error("Failed to fetch rendered video");
    }

    const blob = await response.blob();
    
    if (textEl) {
      textEl.textContent = "Ready to share!";
    }

    if (progressBar) {
      progressBar.style.width = "100%";
    }

    // Close modal after a brief delay
    setTimeout(() => closeShareLoadingModal(), 1000);

  } catch (err) {
    console.error("Failed to update with rendered video:", err);
    if (textEl) {
      textEl.textContent = "Ready to share!";
    }
    setTimeout(() => closeShareLoadingModal(), 1500);
  }
}

/**
 * Get shareable video URL
 */
function getShareableVideoUrl() {
  // If a frame was rendered, use the rendered video URL
  if (state.lastRenderedJobId && state.selectedFrame !== "none") {
    return `${window.location.origin}/api/video/download/${state.lastRenderedJobId}`;
  }
  // Otherwise, return the original video URL
  return `${window.location.origin}/api/video/preview/${state.videoId}`;
}

/**
 * Share video to WhatsApp using native share or WhatsApp Web
 */
async function shareToWhatsApp() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // Check if rendering is needed
  const needsRendering = state.selectedFrame !== "none" && !state.lastRenderedJobId;

  // Determine which video URL to use
  let videoUrl;
  if (state.lastRenderedJobId && state.selectedFrame !== "none") {
    videoUrl = state.lastRenderedUrl;
  } else {
    videoUrl = `${API_BASE}/video/preview/${state.videoId}`;
  }

  // Show loading modal
  showShareLoadingModal(needsRendering);

  try {
    // Fetch the video as a blob
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const blob = await response.blob();
    console.log(`Video blob fetched: ${blob.size} bytes`);

    if (blob.size === 0) {
      throw new Error("Video blob is empty");
    }

    // Start background render if needed
    if (needsRendering) {
      renderVideoInBackground().then((renderedJobId) => {
        if (renderedJobId) {
          state.lastRenderedJobId = renderedJobId;
          state.lastRenderedUrl = `${API_BASE}/video/download/${renderedJobId}`;
        }
      }).catch((err) => {
        console.error("Background render failed:", err);
      });
    }

    closeShareLoadingModal();

    // Try to use native share first (on mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `framed-video-${Date.now()}.mp4`, {
          type: "video/mp4",
        });

        const shareData = {
          files: [file],
          title: "My Framed Video",
          text: "Check out my framed video!",
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          showToast("Video shared via WhatsApp!", "success");
          return;
        }
      } catch (err) {
        console.log("Native share not available, falling back to WhatsApp Web");
      }
    }

    // Fallback: Open WhatsApp Web with shareable link
    try {
      const shareableUrl = getShareableVideoUrl();
      const message = encodeURIComponent(
        `Check out my framed video! ${shareableUrl}`
      );
      window.open(`https://wa.me/?text=${message}`, "_blank");
      showToast("Opening WhatsApp...", "success");
    } catch (err) {
      throw new Error("Failed to open WhatsApp");
    }

  } catch (err) {
    console.error("WhatsApp share error:", err);
    closeShareLoadingModal();
    showToast(err.message || "Failed to share to WhatsApp", "error");
  }
}

/**
 * Copy shareable video link to clipboard
 */
async function copyVideoLink() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // Check if rendering is needed
  const needsRendering = state.selectedFrame !== "none" && !state.lastRenderedJobId;

  // Show loading modal if rendering is needed
  if (needsRendering) {
    showShareLoadingModal(true);

    try {
      // Render the video in background
      const jobId = await renderVideoInBackground();
      if (jobId) {
        state.lastRenderedJobId = jobId;
        state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;
      }
      closeShareLoadingModal();
    } catch (err) {
      console.error("Render error:", err);
      closeShareLoadingModal();
      showToast("Failed to render video for copying", "error");
      return;
    }
  }

  try {
    const shareableUrl = getShareableVideoUrl();
    await navigator.clipboard.writeText(shareableUrl);
    showToast("Link copied to clipboard!", "success");
  } catch (err) {
    console.error("Copy error:", err);
    showToast("Failed to copy link", "error");
  }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("tab-active");
  });

  // Deactivate all buttons
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("tab-active");
  });

  // Show selected tab
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.add("tab-active");
  }

  // Activate selected button
  const selectedBtn = document.querySelector(
    `.tab-button[data-tab="${tabName}"]`
  );
  if (selectedBtn) {
    selectedBtn.classList.add("tab-active");
  }
}

/**
 * Handle file upload
 */
function handleFileUpload(file) {
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("video/")) {
    showToast("Please select a valid video file", "error");
    return;
  }

  // Validate file size (500MB)
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast("File size exceeds 500MB limit", "error");
    return;
  }

  state.isProcessing = true;
  setButtonLoading(elements.previewBtn, true);
  elements.fetchProgress.style.width = "0%";

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Show status bar
    elements.fetchStatus.classList.remove("hidden");
    elements.fetchStatusText.textContent = "Uploading video...";

    // Start the upload
    fetch(`${API_BASE}/video/upload`, {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Failed to upload file");
        }

        if (!data.videoId) {
          throw new Error("No videoId returned from server");
        }

        state.videoId = data.videoId;
        console.log("Upload successful, videoId:", state.videoId);
        elements.fetchStatusText.textContent = "Processing uploaded video...";

        // Poll for status
        pollStatus(
          `/video/status/${data.videoId}`,
          elements.fetchStatus,
          elements.fetchStatusText,
          elements.fetchProgress,
          // On complete
          () => {
            showVideoPreview();
            showToast("Video uploaded successfully!", "success");
            state.isProcessing = false;
            setButtonLoading(
              elements.previewBtn,
              false,
              `
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Fetch & Preview</span>
            `
            );
          },
          // On error
          (err) => {
            showToast(
              err.message || "Failed to process uploaded video",
              "error"
            );
            state.isProcessing = false;
            setButtonLoading(
              elements.previewBtn,
              false,
              `
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Fetch & Preview</span>
            `
            );
          }
        );
      })
      .catch((err) => {
        console.error("Upload error:", err);
        showToast(err.message || "Failed to upload file", "error");
        state.isProcessing = false;
        setButtonLoading(elements.previewBtn, false);
        elements.fetchStatus.classList.add("hidden");
      });
  } catch (err) {
    console.error("Upload error:", err);
    showToast(err.message || "Failed to upload file", "error");
    state.isProcessing = false;
    setButtonLoading(elements.previewBtn, false);
    elements.fetchStatus.classList.add("hidden");
  }
}

// ===========================================
// Event Listeners
// ===========================================

// Tab navigation
elements.urlTab.addEventListener("click", () => switchTab("url-tab"));
elements.uploadTab.addEventListener("click", () => switchTab("upload-tab"));

// File upload - Browse button
elements.uploadFileBtn.addEventListener("click", (e) => {
  e.preventDefault();
  elements.fileInput.click();
});

// File upload - File input change
elements.fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFileUpload(file);
  }
});

// Drag and drop
elements.uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadArea.classList.add("drag-over");
});

elements.uploadArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadArea.classList.remove("drag-over");
});

elements.uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadArea.classList.remove("drag-over");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileUpload(files[0]);
  }
});

// Click upload area to open file picker
elements.uploadArea.addEventListener("click", (e) => {
  if (e.target === elements.uploadArea || e.target.closest(".upload-area")) {
    elements.fileInput.click();
  }
});

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

// Auto-fetch on paste - seamless UX
elements.videoUrl.addEventListener("paste", (e) => {
  // Wait for paste to complete
  setTimeout(() => {
    const url = elements.videoUrl.value.trim();
    if (url && isValidSocialUrl(url) && !state.isProcessing) {
      showToast("Valid URL detected, fetching...", "info");
      updateActionButton();
      fetchVideo();
    }
  }, 100);
});

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

// Share button
elements.shareBtn.addEventListener("click", (e) => {
  e.preventDefault();
  shareVideo();
});

// WhatsApp button
elements.whatsappBtn.addEventListener("click", (e) => {
  e.preventDefault();
  shareToWhatsApp();
});

// Copy link button
elements.copyLinkBtn.addEventListener("click", (e) => {
  e.preventDefault();
  copyVideoLink();
});

// ===========================================
// Initialize
// ===========================================

document.addEventListener("DOMContentLoaded", () => {
  updateActionButton();
  loadFrames();
});
