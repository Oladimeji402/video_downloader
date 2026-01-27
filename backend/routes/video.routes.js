import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import downloader from "../services/downloader.js";
import processor from "../services/processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Frames directory path
const FRAMES_DIR = path.join(__dirname, "..", "frames");

/**
 * POST /api/video/resolve
 * Start downloading video from social media URL
 */
router.post("/resolve", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: "URL is required" 
    });
  }

  // Basic URL validation
  const validDomains = [
    "tiktok.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "twitter.com",
    "x.com",
    "facebook.com",
    "fb.watch"
  ];

  const isValidUrl = validDomains.some((domain) => url.includes(domain));
  
  if (!isValidUrl) {
    return res.status(400).json({
      success: false,
      error: "Please provide a valid TikTok, Instagram, YouTube, Twitter, or Facebook video URL",
    });
  }

  try {
    const result = downloader.startDownload(url);
    
    res.json({
      success: true,
      videoId: result.videoId,
      status: result.status,
      message: "Download started",
    });
  } catch (err) {
    console.error("Error starting download:", err);
    res.status(500).json({
      success: false,
      error: "Failed to start download",
    });
  }
});

/**
 * GET /api/video/status/:videoId
 * Check download status
 */
router.get("/status/:videoId", (req, res) => {
  const { videoId } = req.params;
  const status = downloader.getDownloadStatus(videoId);

  if (!status) {
    return res.status(404).json({
      success: false,
      error: "Video not found",
    });
  }

  res.json({
    success: true,
    videoId: status.videoId,
    status: status.status,
    progress: status.progress,
    error: status.error,
  });
});

/**
 * GET /api/video/preview/:videoId
 * Stream the downloaded video for preview
 */
router.get("/preview/:videoId", (req, res) => {
  const { videoId } = req.params;
  const videoPath = downloader.getVideoPath(videoId);

  if (!videoPath) {
    return res.status(404).json({
      success: false,
      error: "Video not found or still downloading",
    });
  }

  // Get file stats for range requests
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Handle range requests for video seeking
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(videoPath, { start, end });
    
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });
    
    file.pipe(res);
  } else {
    // Send entire file
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    
    fs.createReadStream(videoPath).pipe(res);
  }
});

/**
 * GET /api/frames
 * List available frame templates
 */
router.get("/frames", (req, res) => {
  const frames = processor.getAvailableFrames();
  
  res.json({
    success: true,
    frames,
  });
});

/**
 * GET /api/frames/:filename
 * Serve frame image files
 */
router.get("/frames/:filename", (req, res) => {
  const { filename } = req.params;
  const framePath = path.join(FRAMES_DIR, filename);

  if (!fs.existsSync(framePath)) {
    return res.status(404).json({
      success: false,
      error: "Frame not found",
    });
  }

  res.sendFile(framePath);
});

/**
 * POST /api/video/render
 * Start rendering video with frame overlay
 */
router.post("/render", (req, res) => {
  const { videoId, frameId } = req.body;

  if (!videoId || !frameId) {
    return res.status(400).json({
      success: false,
      error: "videoId and frameId are required",
    });
  }

  const videoPath = downloader.getVideoPath(videoId);
  
  if (!videoPath) {
    return res.status(404).json({
      success: false,
      error: "Source video not found",
    });
  }

  const result = processor.startRender(videoPath, frameId);

  if (result.error) {
    return res.status(400).json({
      success: false,
      error: result.error,
    });
  }

  res.json({
    success: true,
    jobId: result.jobId,
    status: result.status,
    message: "Rendering started",
  });
});

/**
 * GET /api/video/render/:jobId
 * Check render job status
 */
router.get("/render/:jobId", (req, res) => {
  const { jobId } = req.params;
  const status = processor.getRenderStatus(jobId);

  if (!status) {
    return res.status(404).json({
      success: false,
      error: "Render job not found",
    });
  }

  res.json({
    success: true,
    jobId: status.jobId,
    status: status.status,
    progress: status.progress,
    error: status.error,
  });
});

/**
 * GET /api/video/download/:jobId
 * Download the rendered video
 */
router.get("/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const videoPath = processor.getRenderedVideoPath(jobId);

  if (!videoPath) {
    return res.status(404).json({
      success: false,
      error: "Rendered video not found or still processing",
    });
  }

  const filename = `framed-video-${Date.now()}.mp4`;
  
  res.download(videoPath, filename, (err) => {
    if (err) {
      console.error("Download error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Failed to download video",
        });
      }
    }
  });
});

export default router;
