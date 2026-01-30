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
  state.selectedFrame = frameId;
  
  // Reset rendered state when changing frames
  state.lastRenderedJobId = null;
  state.lastRenderedUrl = null;

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
 * Share video using Web Share API (works on mobile for WhatsApp, etc.)
 */
async function shareVideo() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // If a frame is selected and not yet rendered, render it first
  if (state.selectedFrame !== "none" && !state.lastRenderedJobId) {
    showToast("Rendering video with frame...", "info");
    const rendered = await renderVideoForSharing();
    if (!rendered) {
      showToast("Failed to render video", "error");
      return;
    }
  }

  // Get the appropriate video URL
  let videoUrl;
  let videoBlob;
  
  try {
    // If a frame was rendered, use the rendered video
    if (state.lastRenderedJobId && state.selectedFrame !== "none") {
      videoUrl = state.lastRenderedUrl;
      showToast("Preparing framed video for sharing...", "info");
    } else {
      // Otherwise, share the original video
      videoUrl = `${API_BASE}/video/preview/${state.videoId}`;
      showToast("Preparing video for sharing...", "info");
    }

    // Fetch the video as a blob
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    
    videoBlob = await response.blob();
    console.log(`Video blob fetched: ${videoBlob.size} bytes`);
    
    if (videoBlob.size === 0) {
      throw new Error("Video blob is empty");
    }
    
    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare) {
      const file = new File([videoBlob], `framed-video-${Date.now()}.mp4`, {
        type: "video/mp4",
      });

      const shareData = {
        files: [file],
        title: "My Framed Video",
        text: "Check out my framed video!",
      };

      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          showToast("Video shared successfully!", "success");
          console.log("Video shared via Web Share API");
        } catch (shareErr) {
          if (shareErr.name !== "AbortError") {
            console.error("Share failed:", shareErr);
            // Fallback to download if share fails
            showToast("Share cancelled. Try downloading instead.", "info");
          }
        }
      } else {
        throw new Error("Cannot share video files on this device");
      }
    } else {
      // Fallback: download the video instead
      showToast("Share API not supported. Downloading video instead...", "info");
      const url = URL.createObjectURL(videoBlob);
      triggerDownload(url);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("Share error:", err);
    if (err.name === "AbortError") {
      showToast("Share cancelled", "info");
    } else {
      showToast(
        "Unable to share. Try the Download button instead.",
        "warning"
      );
    }
  }
}

/**
 * Share video to WhatsApp using WhatsApp Web URL
 */
async function shareToWhatsApp() {
  if (!state.videoId) {
    showToast("Please fetch a video first", "warning");
    return;
  }

  // If a frame is selected and not yet rendered, render it first
  if (state.selectedFrame !== "none" && !state.lastRenderedJobId) {
    showToast("Rendering video with frame... Please wait", "info");
    const rendered = await renderVideoForSharing();
    if (!rendered) {
      showToast("Failed to render video. Check console for details", "error");
      return;
    }
  }

  try {
    // Get the shareable URL
    const shareableUrl = getShareableVideoUrl();
    
    // Create WhatsApp share message
    const message = encodeURIComponent(
      `Check out my framed video! ${shareableUrl}`
    );
    
    // Open WhatsApp Web/App with the message
    // On mobile, this opens the WhatsApp app
    // On desktop, this opens WhatsApp Web
    const whatsappUrl = `https://wa.me/?text=${message}`;
    
    window.open(whatsappUrl, "_blank");
    showToast("Opening WhatsApp...", "success");
  } catch (err) {
    console.error("WhatsApp share error:", err);
    showToast("Failed to open WhatsApp", "error");
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

  // If a frame is selected and not yet rendered, render it first
  if (state.selectedFrame !== "none" && !state.lastRenderedJobId) {
    showToast("Rendering video with frame... Please wait", "info");
    const rendered = await renderVideoForSharing();
    if (!rendered) {
      showToast("Failed to render video. Check console for details", "error");
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
 * Render video for sharing (without downloading)
 */
async function renderVideoForSharing() {
  if (!state.videoId || state.selectedFrame === "none") {
    return true; // No rendering needed
  }

  try {
    console.log("Starting render for sharing...");
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

    // Poll for render completion with exponential backoff
    let pollCount = 0;
    const maxPolls = 300; // 5 minutes max
    let pollDelay = 2000; // Start with 2 seconds to avoid rate limit
    let rateLimited = false;

    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, pollDelay));
      
      try {
        const statusResponse = await fetch(`${API_BASE}/video/render/${jobId}`);
        
        // Handle rate limiting with exponential backoff
        if (statusResponse.status === 429) {
          rateLimited = true;
          pollDelay = Math.min(pollDelay * 2, 30000); // Cap at 30 seconds
          console.warn(`Rate limited. Next poll in ${pollDelay}ms`);
          pollCount++;
          continue;
        }

        if (!statusResponse.ok) {
          console.error(`Status check failed: ${statusResponse.status}`);
          throw new Error(`Status check failed with status ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        console.log(`Poll ${pollCount + 1}: status = ${statusData.status}, progress = ${statusData.progress}%`);

        if (!statusData.success) {
          throw new Error(statusData.error || "Render failed");
        }

        // Reset poll delay on successful response
        if (rateLimited) {
          pollDelay = 2000;
          rateLimited = false;
        }

        if (statusData.status === "completed") {
          // Store the rendered video info
          state.lastRenderedJobId = jobId;
          state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;
          console.log("Render completed successfully!");
          return true;
        }

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "Render job failed");
        }

        // Success but still processing - continue polling
      } catch (pollErr) {
        console.error(`Poll error: ${pollErr.message}`);
        // For other errors, increase delay slightly but continue
        if (!rateLimited) {
          pollDelay = Math.min(pollDelay * 1.5, 10000);
        }
      }

      pollCount++;
    }

    throw new Error("Render timeout after 5 minutes");
  } catch (err) {
    console.error("Render error:", err);
    return false;
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
