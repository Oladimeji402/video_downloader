/**
 * FrameIt Frontend
 * Handles video URL resolution, preview, frame selection, and download
 */

// ===========================================
// Configuration
// ===========================================
const API_BASE = window.ENV?.API_URL || "http://localhost:4000/api";
const POLL_INTERVAL = 800;

// ===========================================
// DOM Elements
// ===========================================
const elements = {
  videoUrl: document.getElementById("videoUrl"),
  actionBtn: document.getElementById("actionBtn"),
  previewBtn: document.getElementById("previewBtn"),

  fetchStatus: document.getElementById("fetchStatus"),
  fetchStatusText: document.getElementById("fetchStatusText"),
  fetchProgress: document.getElementById("fetchProgress"),

  previewSection: document.getElementById("previewSection"),
  framePreview: document.getElementById("framePreview"),
  videoPlayer: document.getElementById("videoPlayer"),
  frameOverlay: document.getElementById("frameOverlay"),
  frameOptions: document.getElementById("frameOptions"),
  noFramesMsg: document.getElementById("noFramesMsg"),

  downloadSection: document.getElementById("downloadSection"),
  downloadBtn: document.getElementById("downloadBtn"),
  renderStatus: document.getElementById("renderStatus"),
  renderStatusText: document.getElementById("renderStatusText"),
  renderProgress: document.getElementById("renderProgress"),

  shareBtn: document.getElementById("shareBtn"),
  whatsappBtn: document.getElementById("whatsappBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),

  toastContainer: document.getElementById("toastContainer"),

  serverBanner: document.getElementById("serverBanner"),
  serverBannerText: document.getElementById("serverBannerText"),

  videoUpload: document.getElementById("videoUpload"),
  uploadBtnText: document.getElementById("uploadBtnText"),
  fetchErrorHint: document.getElementById("fetchErrorHint"),
  fetchErrorText: document.getElementById("fetchErrorText"),
  retryUploadBtn: document.getElementById("retryUploadBtn"),
  uploadLabel: document.querySelector(".btn-upload"),
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
  renderedVideoBlob: null,
  serverReady: false,
  bgRenderPromise: null, // background pre-render promise
};

const frameImageCache = new Map();

// ===========================================
// Valid URL Domains
// ===========================================
const VALID_DOMAINS = [
  "tiktok.com", "instagram.com", "youtube.com", "youtu.be",
  "twitter.com", "x.com", "facebook.com", "fb.watch"
];

function isValidSocialUrl(url) {
  if (!url || typeof url !== "string") return false;
  return VALID_DOMAINS.some(d => url.includes(d));
}

// ===========================================
// Server Wake-up
// ===========================================
async function wakeServer() {
  const banner = elements.serverBanner;
  const text = elements.serverBannerText;

  banner.classList.add("visible");
  text.textContent = "Waking up server...";

  const start = Date.now();
  let attempts = 0;
  const maxAttempts = 20; // ~60s total for cold starts

  while (attempts < maxAttempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        state.serverReady = true;
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        text.textContent = `Server ready (${elapsed}s)`;
        banner.classList.add("ready");

        setTimeout(() => {
          banner.classList.remove("visible", "ready");
        }, 2000);
        return;
      }
    } catch (_) {
      // Server still waking up
    }

    attempts++;
    const waitMsg = attempts > 3
      ? "Server is cold-starting, hang tight..."
      : "Connecting to server...";
    text.textContent = waitMsg;
    await new Promise(r => setTimeout(r, 3000));
  }

  text.textContent = "Server unavailable â€” try refreshing";
  setTimeout(() => banner.classList.remove("visible"), 6000);
}

// ===========================================
// Utility Functions
// ===========================================
function showToast(message, type = "info", duration = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(12px)";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function hideFetchError() {
  elements.fetchErrorHint.classList.add("hidden");
  elements.uploadLabel?.classList.remove("upload-highlight");
}

function showFetchError(message, suggestUpload = false) {
  elements.fetchErrorText.textContent = message;
  elements.fetchErrorHint.classList.remove("hidden");

  if (suggestUpload && elements.uploadLabel) {
    elements.uploadLabel.classList.add("upload-highlight");
    elements.fetchErrorHint.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function triggerUploadPicker() {
  elements.videoUpload?.click();
}

function updateActionButton() {
  const hasValue = elements.videoUrl.value.trim().length > 0;
  const btn = elements.actionBtn;
  if (hasValue) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    btn.title = "Clear";
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    btn.title = "Paste from clipboard";
  }
}

function setGoLoading(loading) {
  const btn = elements.previewBtn;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div><span>Fetching...</span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg><span>Go</span>`;
  }
}

// ===========================================
// Polling
// ===========================================
async function pollStatus(endpoint, statusEl, textEl, progressEl, onComplete, onError) {
  let pollCount = 0;
  const maxPolls = 300;

  const poll = async () => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Unknown error");

      if (progressEl && data.progress !== undefined) {
        progressEl.style.width = `${data.progress}%`;
      }
      if (textEl) {
        const label = data.status === "downloading" ? "Downloading" : "Processing";
        textEl.textContent = `${label}... ${Math.round(data.progress || 0)}%`;
      }

      if (data.status === "completed") {
        statusEl.classList.add("hidden");
        onComplete(data);
        return;
      }
      if (data.status === "failed") {
        statusEl.classList.add("hidden");
        const err = new Error(data.error || "Processing failed");
        err.errorCode = data.errorCode;
        err.suggestUpload = data.suggestUpload;
        err.platform = data.platform;
        onError(err);
        return;
      }

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
async function loadFrames() {
  try {
    const res = await fetch(`${API_BASE}/frames`);
    const data = await res.json();

    if (data.success && data.frames.length > 0) {
      state.frames = data.frames;
      renderFrameOptions();
      elements.noFramesMsg.classList.add("hidden");
      preloadAllFrames();

      // Pre-select first frame
      if (state.frames.length > 0) {
        state.selectedFrame = state.frames[0].id;
        setTimeout(() => {
          const first = document.querySelector(`[data-frame="${state.frames[0].id}"]`);
          if (first) {
            document.querySelectorAll(".frame-option").forEach(o => o.classList.remove("selected"));
            first.classList.add("selected");
          }
        }, 50);
      }
    } else {
      elements.noFramesMsg.classList.remove("hidden");
    }
  } catch (_) {
    elements.noFramesMsg.classList.remove("hidden");
  }
}

function renderFrameOptions() {
  const noFrameOption = elements.frameOptions.querySelector('[data-frame="none"]');
  elements.frameOptions.innerHTML = "";
  if (noFrameOption) elements.frameOptions.appendChild(noFrameOption);

  state.frames.forEach(frame => {
    const option = document.createElement("button");
    option.className = "frame-option";
    option.dataset.frame = frame.id;
    option.innerHTML = `
      <div class="frame-thumb">
        <img src="${API_BASE}${frame.path}" alt="${frame.name}" loading="lazy" />
      </div>
      <span>${frame.name}</span>
    `;
    option.addEventListener("click", () => selectFrame(frame.id));
    elements.frameOptions.appendChild(option);
  });
}

function selectFrame(frameId) {
  if (state.selectedFrame === frameId) return;

  state.selectedFrame = frameId;
  state.renderedVideoBlob = null;
  state.lastRenderedJobId = null;
  state.lastRenderedUrl = null;
  state.bgRenderPromise = null;

  document.querySelectorAll(".frame-option").forEach(opt => {
    opt.classList.toggle("selected", opt.dataset.frame === frameId);
  });

  updateFramePreview(frameId);

  if (frameId !== "none") {
    preloadFrameImage(frameId);
    elements.downloadBtn.disabled = false;
    elements.shareBtn.disabled = false;

    // Start background pre-render immediately
    if (state.videoId) {
      startBackgroundPreRender();
    }
  }
}

function updateFramePreview(frameId) {
  const overlay = elements.frameOverlay;
  const preview = elements.framePreview;

  overlay.style.backgroundImage = "";
  overlay.style.backgroundColor = "";
  overlay.classList.remove("visible");
  preview.removeAttribute("data-frame");

  if (frameId === "none") return;

  const cssFrames = ["blue", "gold", "neon", "gradient"];
  if (cssFrames.includes(frameId)) {
    preview.setAttribute("data-frame", frameId);
    overlay.classList.add("visible");
  } else {
    const frame = state.frames.find(f => f.id === frameId);
    if (frame) {
      overlay.style.backgroundImage = `url("${API_BASE}${encodeURI(frame.path)}")`;
      overlay.classList.add("visible");
    }
  }
}

function preloadFrameImage(frameId) {
  if (frameImageCache.has(frameId)) return;
  const frame = state.frames.find(f => f.id === frameId);
  if (frame && frame.path) {
    const img = new Image();
    img.src = `${API_BASE}${frame.path}`;
    frameImageCache.set(frameId, img);
  }
}

function preloadAllFrames() {
  state.frames.forEach(f => {
    if (f.id && f.id !== "none") preloadFrameImage(f.id);
  });
}

// ===========================================
// Background Pre-Render
// ===========================================
function startBackgroundPreRender() {
  if (!state.videoId || state.selectedFrame === "none") return;

  // Don't re-start if already rendering this combination
  state.bgRenderPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/video/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: state.videoId, frameId: state.selectedFrame }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success) return null;

      const jobId = await pollRenderJob(data.jobId);
      state.lastRenderedJobId = jobId;
      state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;

      // Pre-fetch the blob
      const videoRes = await fetch(state.lastRenderedUrl);
      state.renderedVideoBlob = await videoRes.blob();
      return jobId;
    } catch (_) {
      return null;
    }
  })();
}

// ===========================================
// Render
// ===========================================
async function renderVideoWithFrame(progressCallback) {
  if (!state.videoId || state.selectedFrame === "none") {
    throw new Error("No video or frame selected");
  }

  // If pre-render already finished
  if (state.renderedVideoBlob) return state.renderedVideoBlob;

  // If pre-render is in progress, wait for it
  if (state.bgRenderPromise) {
    const jobId = await state.bgRenderPromise;
    if (jobId && state.renderedVideoBlob) return state.renderedVideoBlob;
  }

  // Start fresh render
  const res = await fetch(`${API_BASE}/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId: state.videoId, frameId: state.selectedFrame }),
  });

  if (!res.ok) {
    const err = await res.json();
    // Better error messages
    let errorMsg = err.error || "Rendering failed";
    if (errorMsg.includes("not found")) {
      errorMsg = "Video file not found. Please try fetching again.";
    } else if (errorMsg.includes("Frame") && errorMsg.includes("not found")) {
      errorMsg = "Frame template not found. Please select another frame.";
    }
    throw new Error(errorMsg);
  }

  const { jobId } = await res.json();
  const startTime = Date.now();
  let slowWarningShown = false;

  // Poll completion
  while (true) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const statusRes = await fetch(`${API_BASE}/video/render/${jobId}`);
    const status = await statusRes.json();

    if (status.status === "completed") {
      const videoRes = await fetch(`${API_BASE}/video/download/${jobId}`);
      const blob = await videoRes.blob();
      state.renderedVideoBlob = blob;
      state.lastRenderedJobId = jobId;
      state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;
      return blob;
    }
    if (status.status === "failed") {
      let errorMsg = status.error || "Rendering failed";
      throw new Error(errorMsg);
    }
    if (progressCallback && status.progress) {
      // Show helpful message for long renders
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 60 && !slowWarningShown && status.progress < 80) {
        slowWarningShown = true;
        progressCallback(status.progress, "Long video - this may take 2-3 minutes on free hosting...");
      } else {
        progressCallback(status.progress);
      }
    }
  }
}

async function pollRenderJob(jobId) {
  let pollCount = 0;
  const maxPolls = 300;
  let delay = 800;

  while (pollCount < maxPolls) {
    await new Promise(r => setTimeout(r, delay));

    try {
      const res = await fetch(`${API_BASE}/video/render/${jobId}`);
      if (res.status === 429) { delay = Math.min(delay * 1.5, 8000); pollCount++; continue; }
      if (res.status === 404) { delay = Math.min(delay + 200, 3000); pollCount++; continue; }
      if (!res.ok) { pollCount++; continue; }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Render failed");
      if (delay > 800) delay = 800;
      if (data.status === "completed") return jobId;
      if (data.status === "failed") throw new Error(data.error || "Render failed");
      pollCount++;
    } catch (err) {
      if (err.message.includes("Render") || err.message.includes("failed")) throw err;
      pollCount++;
    }
  }

  throw new Error("Render timeout");
}

// ===========================================
// Video Operations
// ===========================================
async function uploadVideo(file) {
  if (!file) {
    showToast("Choose a video file first", "warning");
    return;
  }

  if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|webm)$/i)) {
    showToast("Please choose a video file (MP4, MOV, or WebM)", "warning");
    return;
  }

  if (!state.serverReady) {
    showToast("Server is still starting up, please wait...", "warning");
    return;
  }

  hideFetchError();
  state.isProcessing = true;
  setGoLoading(true);
  elements.fetchProgress.style.width = "0%";
  elements.fetchStatusText.textContent = "Uploading video...";
  elements.fetchStatus.classList.remove("hidden");
  elements.uploadBtnText.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/video/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Upload failed");
    }

    if (!data.videoId) throw new Error("No videoId returned");

    state.videoId = data.videoId;
    elements.fetchProgress.style.width = "100%";
    elements.fetchStatus.classList.add("hidden");
    showVideoPreview();
    showToast("Video uploaded!", "success");
  } catch (err) {
    showToast(err.message || "Failed to upload video", "error", 5000);
    elements.fetchStatus.classList.add("hidden");
  } finally {
    state.isProcessing = false;
    setGoLoading(false);
    elements.uploadBtnText.textContent = "Upload video file";
    if (elements.videoUpload) elements.videoUpload.value = "";
  }
}

async function fetchVideo() {
  const url = elements.videoUrl.value.trim();
  if (!url) { showToast("Paste a video URL first", "warning"); return; }

  if (!state.serverReady) {
    showToast("Server is still starting up, please wait...", "warning");
    return;
  }

  state.isProcessing = true;
  setGoLoading(true);
  hideFetchError();
  elements.fetchProgress.style.width = "0%";

  try {
    const res = await fetch(`${API_BASE}/video/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    
    if (!data.success) {
      // Better error messages
      let errorMsg = data.error || "Failed to start download";
      if (errorMsg.includes("Unsupported URL")) {
        errorMsg = "Please use a TikTok, Instagram, YouTube, Twitter, or Facebook link";
      } else if (errorMsg.includes("Rate limit")) {
        errorMsg = data.error; // Keep the detailed rate limit message
      }
      throw new Error(errorMsg);
    }
    
    if (!data.videoId) throw new Error("No videoId returned");

    state.videoId = data.videoId;
    elements.fetchStatusText.textContent = "Fetching video...";

    pollStatus(
      `/video/status/${data.videoId}`,
      elements.fetchStatus,
      elements.fetchStatusText,
      elements.fetchProgress,
      () => {
        showVideoPreview();
        showToast("Video loaded!", "success");
        state.isProcessing = false;
        setGoLoading(false);
      },
      (err) => {
        let errorMsg = err.message || "Failed to download video";

        if (err.suggestUpload || err.errorCode === "INSTAGRAM_AUTH_REQUIRED") {
          showFetchError(errorMsg, true);
          showToast(errorMsg, "error", 6000);
        } else {
          showToast(errorMsg, "error", 5000);
        }

        state.isProcessing = false;
        setGoLoading(false);
      }
    );
  } catch (err) {
    showToast(err.message || "Failed to connect to server", "error");
    state.isProcessing = false;
    setGoLoading(false);
    elements.fetchStatus.classList.add("hidden");
  }
}

function showVideoPreview() {
  if (!state.videoId) { showToast("Error: Video ID missing", "error"); return; }

  const videoUrl = `${API_BASE}/video/preview/${state.videoId}?t=${Date.now()}`;

  elements.videoPlayer.innerHTML = "";
  const source = document.createElement("source");
  source.src = videoUrl;
  source.type = "video/mp4";
  elements.videoPlayer.appendChild(source);
  elements.videoPlayer.setAttribute("playsinline", "true");
  elements.videoPlayer.setAttribute("webkit-playsinline", "true");
  elements.videoPlayer.preload = "metadata";
  elements.videoPlayer.load();

  elements.videoPlayer.onerror = () => {
    const error = elements.videoPlayer.error;
    let msg = "Failed to load video";
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_NETWORK: msg = "Network error loading video"; break;
        case error.MEDIA_ERR_DECODE: msg = "Video codec not supported"; break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = "Video format not supported"; break;
      }
    }
    showToast(msg, "error");
  };

  elements.previewSection.classList.remove("hidden");
  elements.downloadSection.classList.remove("hidden");

  setTimeout(() => {
    elements.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  if (state.selectedFrame && state.selectedFrame !== "none") {
    updateFramePreview(state.selectedFrame);
    // Start pre-render immediately
    startBackgroundPreRender();
  }
}

// ===========================================
// Download
// ===========================================
async function downloadVideo() {
  if (!state.videoId) { showToast("Fetch a video first", "warning"); return; }

  if (state.selectedFrame === "none") {
    downloadOriginalVideo();
    return;
  }

  state.isProcessing = true;
  const btn = elements.downloadBtn;
  btn.disabled = true;

  try {
    // Show download modal with render progress
    showDownloadModal(true);
    updateDownloadModalProgress(0, "Rendering with frame...");

    const blob = await renderVideoWithFrame((progress, message) => {
      const displayMsg = message || `Rendering... ${progress}%`;
      updateDownloadModalProgress(progress, displayMsg);
    });

    // Update modal for download preparation
    updateDownloadModalProgress(100, "Preparing download...");

    // Check file size
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`Download size: ${fileSizeMB}MB`);

    // For iOS, use a different approach
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // On iOS, create a shareable URL and prompt user
      updateDownloadModalProgress(100, `Ready (${fileSizeMB}MB) - Tap to save`);
      
      // Try native share first (better for iOS)
      try {
        const file = new File([blob], `framed-video-${Date.now()}.mp4`, { type: "video/mp4" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          closeDownloadModal();
          await navigator.share({ files: [file], title: "Framed Video" });
          showToast("Video saved!", "success");
          return;
        }
      } catch (shareErr) {
        console.log("Native share failed, using fallback:", shareErr);
      }
    }

    // Standard download (desktop and fallback for mobile)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `framed-video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    
    // Show success in modal briefly before closing
    updateDownloadModalProgress(100, `Downloading (${fileSizeMB}MB)...`);
    
    // Clean up after a delay
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
      closeDownloadModal();
      
      if (isIOS) {
        showToast(`Check Files app for download (${fileSizeMB}MB)`, "success");
      } else {
        showToast("Download complete!", "success");
      }
    }, 1500);
  } catch (err) {
    closeDownloadModal();
    
    // Better error messages
    let errorMsg = "Failed to render video";
    if (err.message.includes("timeout")) {
      errorMsg = "Rendering timed out. Try a shorter video.";
    } else if (err.message.includes("not found")) {
      errorMsg = "Video file not found. Please try again.";
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    showToast(errorMsg, "error");
  } finally {
    state.isProcessing = false;
    btn.disabled = false;
  }
}

async function downloadOriginalVideo() {
  const btn = elements.downloadBtn;
  btn.disabled = true;

  try {
    // Show download modal
    showDownloadModal(false);
    updateDownloadModalProgress(0, "Downloading video...");

    const res = await fetch(`${API_BASE}/video/preview/${state.videoId}`);
    if (!res.ok) throw new Error("Failed to download video");
    
    const contentLength = res.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = res.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (total) {
        const progress = Math.round((loaded / total) * 100);
        updateDownloadModalProgress(progress, `Downloading... ${progress}%`);
      }
    }

    const blob = new Blob(chunks, { type: 'video/mp4' });
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // On iOS, try native share first
      updateDownloadModalProgress(100, `Ready (${fileSizeMB}MB) - Tap to save`);
      
      try {
        const file = new File([blob], `video-${Date.now()}.mp4`, { type: "video/mp4" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          closeDownloadModal();
          await navigator.share({ files: [file], title: "Video" });
          showToast("Video saved!", "success");
          btn.disabled = false;
          return;
        }
      } catch (shareErr) {
        console.log("Native share failed, using fallback:", shareErr);
      }
    }
    
    // Standard download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    
    // Show success in modal briefly before closing
    updateDownloadModalProgress(100, `Downloading (${fileSizeMB}MB)...`);
    
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
      closeDownloadModal();
      
      if (isIOS) {
        showToast(`Check Files app for download (${fileSizeMB}MB)`, "success");
      } else {
        showToast("Download complete!", "success");
      }
    }, 1500);
  } catch (err) {
    closeDownloadModal();
    
    let errorMsg = "Failed to download video";
    if (err.message.includes("timeout")) {
      errorMsg = "Download timed out. The video might be too large.";
    } else if (err.message.includes("not found")) {
      errorMsg = "Video not found. Please try again.";
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    showToast(errorMsg, "error");
  } finally {
    btn.disabled = false;
  }
}

// ===========================================
// Share
// ===========================================
async function shareVideo() {
  if (!state.videoId) { showToast("Fetch a video first", "warning"); return; }

  try {
    let blob;
    if (state.selectedFrame !== "none") {
      showShareLoadingModal(true);
      blob = await renderVideoWithFrame();
      closeShareLoadingModal();
    } else {
      showShareLoadingModal(false);
      const res = await fetch(`${API_BASE}/video/preview/${state.videoId}`);
      if (!res.ok) throw new Error("Failed to fetch video");
      blob = await res.blob();
      closeShareLoadingModal();
    }

    if (blob.size === 0) throw new Error("Video blob is empty");
    await shareBlob(blob);
  } catch (err) {
    closeShareLoadingModal();
    if (err.name !== "AbortError") {
      showToast(err.message || "Unable to share video", "error");
    }
  }
}

async function shareBlob(blob) {
  if (!navigator.share || !navigator.canShare) {
    throw new Error("Share API not supported on this device");
  }
  const file = new File([blob], `framed-video-${Date.now()}.mp4`, { type: "video/mp4" });
  const shareData = { files: [file], title: "My Framed Video", text: "Check out this video!" };
  if (!navigator.canShare(shareData)) throw new Error("Cannot share video files on this device");
  await navigator.share(shareData);
  showToast("Video shared!", "success");
}

async function shareToWhatsApp() {
  if (!state.videoId) { showToast("Fetch a video first", "warning"); return; }

  const needsRendering = state.selectedFrame !== "none" && !state.lastRenderedJobId;

  try {
    let blob, videoUrl;

    if (needsRendering) {
      showShareLoadingModal(true);
      try {
        // Try to use pre-rendered blob
        blob = await renderVideoWithFrame();
        videoUrl = state.lastRenderedUrl;
      } catch (renderErr) {
        closeShareLoadingModal();
        
        // Better error messages
        let errorMsg = "Failed to render video";
        if (renderErr.message.includes("too long")) {
          errorMsg = "Video is too long. Maximum 3 minutes allowed.";
        } else if (renderErr.message) {
          errorMsg = renderErr.message;
        }
        
        showToast(errorMsg, "error");
        return;
      }
    } else {
      showShareLoadingModal(false);
      videoUrl = state.lastRenderedJobId && state.selectedFrame !== "none"
        ? state.lastRenderedUrl
        : `${API_BASE}/video/preview/${state.videoId}`;

      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error("Failed to fetch video");
      blob = await res.blob();
    }

    if (blob.size === 0) throw new Error("Video blob is empty");
    closeShareLoadingModal();

    // Try native share first (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `framed-video-${Date.now()}.mp4`, { type: "video/mp4" });
        const shareData = { files: [file], title: "My Framed Video" };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          showToast("Video shared!", "success");
          return;
        }
      } catch (_) { /* fallback below */ }
    }

    // Fallback: WhatsApp Web link
    const shareableUrl = getShareableVideoUrl();
    const message = encodeURIComponent(`Check out my framed video! ${shareableUrl}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
    showToast("Opening WhatsApp...", "success");
  } catch (err) {
    closeShareLoadingModal();
    
    let errorMsg = "Failed to share to WhatsApp";
    if (err.message.includes("too long")) {
      errorMsg = "Video is too long. Maximum 3 minutes allowed.";
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    showToast(errorMsg, "error");
  }
}

function getShareableVideoUrl() {
  if (state.lastRenderedJobId && state.selectedFrame !== "none") {
    return `${window.location.origin}/api/video/download/${state.lastRenderedJobId}`;
  }
  return `${window.location.origin}/api/video/preview/${state.videoId}`;
}

async function copyVideoLink() {
  if (!state.videoId) { showToast("Fetch a video first", "warning"); return; }

  const needsRendering = state.selectedFrame !== "none" && !state.lastRenderedJobId;

  if (needsRendering) {
    showShareLoadingModal(true);
    try {
      await renderVideoWithFrame();
      closeShareLoadingModal();
    } catch (err) {
      closeShareLoadingModal();
      showToast("Failed to render video", "error");
      return;
    }
  }

  try {
    await navigator.clipboard.writeText(getShareableVideoUrl());
    showToast("Link copied!", "success");
  } catch (_) {
    showToast("Failed to copy link", "error");
  }
}

// ===========================================
// Share Loading Modal
// ===========================================
function showShareLoadingModal(showRenderProgress = false) {
  const existing = document.getElementById("shareModalOverlay");
  if (existing) existing.remove();

  const html = `
    <div class="share-modal-overlay" id="shareModalOverlay">
      <div class="share-modal">
        <div class="share-modal-content">
          <div class="share-spinner-large"></div>
          <h3 class="share-modal-title">Preparing Video</h3>
          <p class="share-modal-text" id="shareModalText">
            ${showRenderProgress ? "Rendering with frame..." : "Opening share..."}
          </p>
          ${showRenderProgress ? '<div class="share-modal-progress"><div class="share-modal-progress-bar" id="shareModalProgressBar"></div></div>' : ''}
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
}

function closeShareLoadingModal() {
  const modal = document.getElementById("shareModalOverlay");
  if (modal) modal.remove();
}

// ===========================================
// Download Modal
// ===========================================
function showDownloadModal(showProgress = false) {
  const existing = document.getElementById("downloadModalOverlay");
  if (existing) existing.remove();

  const html = `
    <div class="share-modal-overlay" id="downloadModalOverlay">
      <div class="share-modal">
        <div class="share-modal-content">
          <div class="share-spinner-large"></div>
          <h3 class="share-modal-title">Downloading Video</h3>
          <p class="share-modal-text" id="downloadModalText">
            ${showProgress ? "Rendering with frame..." : "Preparing download..."}
          </p>
          ${showProgress ? '<div class="share-modal-progress"><div class="share-modal-progress-bar" id="downloadModalProgressBar"></div></div>' : '<div class="share-modal-progress"><div class="share-modal-progress-bar" id="downloadModalProgressBar"></div></div>'}
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
}

function updateDownloadModalProgress(progress, text) {
  const textEl = document.getElementById("downloadModalText");
  const progressBar = document.getElementById("downloadModalProgressBar");
  
  if (textEl) textEl.textContent = text;
  if (progressBar) progressBar.style.width = `${progress}%`;
}

function closeDownloadModal() {
  const modal = document.getElementById("downloadModalOverlay");
  if (modal) modal.remove();
}

// ===========================================
// Event Listeners
// ===========================================

// Paste / Clear
elements.actionBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (elements.videoUrl.value.trim()) {
    elements.videoUrl.value = "";
    state.videoId = null;
    state.selectedFrame = "none";
    state.bgRenderPromise = null;
    elements.previewSection.classList.add("hidden");
    elements.downloadSection.classList.add("hidden");
  } else {
    try {
      const text = await navigator.clipboard.readText();
      elements.videoUrl.value = text;
    } catch (_) {
      showToast("Unable to access clipboard", "error");
    }
  }
  updateActionButton();
});

elements.videoUrl.addEventListener("input", updateActionButton);

// Auto-fetch on paste if valid URL
elements.videoUrl.addEventListener("paste", () => {
  setTimeout(() => {
    const url = elements.videoUrl.value.trim();
    if (url && isValidSocialUrl(url) && !state.isProcessing) {
      updateActionButton();
      fetchVideo();
    }
  }, 100);
});

elements.videoUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); if (!state.isProcessing) fetchVideo(); }
});

elements.previewBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!state.isProcessing) fetchVideo();
});

elements.videoUpload?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file && !state.isProcessing) uploadVideo(file);
});

elements.retryUploadBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  triggerUploadPicker();
});

elements.downloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!state.isProcessing) downloadVideo();
});

elements.frameOptions.addEventListener("click", (e) => {
  const option = e.target.closest(".frame-option");
  if (option && option.dataset.frame) selectFrame(option.dataset.frame);
});

elements.shareBtn.addEventListener("click", (e) => { e.preventDefault(); shareVideo(); });
elements.whatsappBtn.addEventListener("click", (e) => { e.preventDefault(); shareToWhatsApp(); });
elements.copyLinkBtn.addEventListener("click", (e) => { e.preventDefault(); copyVideoLink(); });

// ===========================================
// Initialize
// ===========================================
document.addEventListener("DOMContentLoaded", () => {
  updateActionButton();
  wakeServer().then(() => {
    loadFrames();
    // Ping server every 14 min to prevent Render free-tier cold starts
    setInterval(() => {
      fetch(`${API_BASE}/health`).catch(() => {});
    }, 14 * 60 * 1000);
  });
});
