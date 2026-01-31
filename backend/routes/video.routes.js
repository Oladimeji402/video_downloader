import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import downloader from "../services/downloader.js";
import processor from "../services/processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, "..", "temp", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Use a UUID-based filename to avoid conflicts
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = file.mimetype.split("/")[1] === "quicktime" ? "mov" : "mp4";
      cb(null, `${timestamp}-${random}.${ext}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    // Only accept video files
    if (file.mimetype.startsWith("video/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

// Frames directory path
const FRAMES_DIR = path.join(__dirname, "..", "frames");

/**
 * POST /api/video/resolve
 * Start downloading video from social media URL
 */
router.post("/resolve", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: "Please paste a video URL to get started" 
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
      error: "Unsupported URL. We support TikTok, Instagram, YouTube, Twitter/X, and Facebook videos.",
    });
  }

  try {
    const result = await downloader.startDownload(url);
    
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
      error: "Could not start download. The video might be private or unavailable.",
    });
  }
});

/**
 * POST /api/video/upload
 * Handle video file upload
 */
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const result = downloader.handleUploadedFile(req.file);

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      videoId: result.videoId,
      status: result.status,
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to upload file: " + err.message,
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

  // If completed, check if file actually exists and get size
  let fileSize = null;
  if (status.status === "completed" && status.outputPath) {
    try {
      if (fs.existsSync(status.outputPath)) {
        fileSize = fs.statSync(status.outputPath).size;
        console.log(`Video ${videoId}: ${fileSize} bytes`);
      } else {
        console.error(`Video file missing for ${videoId}: ${status.outputPath}`);
      }
    } catch (err) {
      console.error(`Error checking file for ${videoId}:`, err);
    }
  }

  res.json({
    success: true,
    videoId: status.videoId,
    status: status.status,
    progress: status.progress,
    error: status.error,
    fileSize: fileSize,
    isUploaded: status.isUploaded || false,
  });
});

/**
 * GET /api/video/preview/:videoId
 * Stream the downloaded video for preview
 */
router.get("/preview/:videoId", (req, res) => {
  try {
    const { videoId } = req.params;
    const videoPath = downloader.getVideoPath(videoId);

    if (!videoPath) {
      console.warn(`Video not found for ID: ${videoId}`);
      return res.status(404).json({
        success: false,
        error: "Video not found or still downloading",
      });
    }

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`File not found at path: ${videoPath}`);
      return res.status(404).json({
        success: false,
        error: "Video file not found",
      });
    }

    // Get file stats for range requests
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    
    // Check if file is valid
    if (fileSize === 0) {
      console.error(`Video file is empty: ${videoPath}`);
      return res.status(400).json({
        success: false,
        error: "Video file is empty or corrupted",
      });
    }

    const range = req.headers.range;

    // Set common headers for all responses
    const headers = {
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    };

    if (range) {
      // Handle range requests for video seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      console.log(`Range request: bytes ${start}-${end}/${fileSize}`);

      const file = fs.createReadStream(videoPath, { start, end });
      
      res.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunkSize,
      });
      
      file.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Error streaming video",
          });
        }
      });
      
      file.pipe(res);
    } else {
      // Send entire file
      console.log(`Full video request: ${fileSize} bytes`);
      
      res.writeHead(200, {
        ...headers,
        "Content-Length": fileSize,
      });
      
      const file = fs.createReadStream(videoPath);
      
      file.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Error streaming video",
          });
        }
      });
      
      file.pipe(res);
    }
  } catch (err) {
    console.error("Preview endpoint error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to stream video: " + err.message,
    });
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
router.post("/render", async (req, res) => {
  const { videoId, frameId } = req.body;

  if (!videoId || !frameId) {
    return res.status(400).json({
      success: false,
      error: "videoId and frameId are required",
    });
  }

  console.log(`[RENDER] Received render request: videoId=${videoId}, frameId="${frameId}"`);

  const videoPath = downloader.getVideoPath(videoId);
  
  if (!videoPath) {
    return res.status(404).json({
      success: false,
      error: "Source video not found",
    });
  }

  const result = await processor.startRender(videoPath, frameId);

  if (result.error) {
    console.error(`[RENDER] Render failed for frameId="${frameId}": ${result.error}`);
    return res.status(400).json({
      success: false,
      error: result.error,
    });
  }

  console.log(`[RENDER] Render started: jobId=${result.jobId}, frameId="${frameId}"`);
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

/**
 * GET /api/video/debug/:videoId
 * Debug endpoint to check video file status
 */
router.get("/debug/:videoId", (req, res) => {
  const { videoId } = req.params;
  const status = downloader.getDownloadStatus(videoId);
  
  if (!status) {
    return res.json({
      videoId,
      found: false,
      error: "Video not found in memory",
    });
  }

  let fileInfo = null;
  if (status.outputPath && fs.existsSync(status.outputPath)) {
    try {
      const stat = fs.statSync(status.outputPath);
      fileInfo = {
        path: status.outputPath,
        size: stat.size,
        exists: true,
        mtime: stat.mtime,
      };
    } catch (err) {
      fileInfo = {
        path: status.outputPath,
        exists: false,
        error: err.message,
      };
    }
  }

  res.json({
    videoId,
    status: status.status,
    progress: status.progress,
    isUploaded: status.isUploaded || false,
    createdAt: new Date(status.createdAt).toISOString(),
    file: fileInfo,
    error: status.error,
  });
});

export default router;
