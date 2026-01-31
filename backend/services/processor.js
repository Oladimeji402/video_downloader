import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import Queue from "bull";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import logger from "./logger.js";
import { isRedisConnected } from "./redis.js";

// Try to use ffmpeg-static, fall back to system ffmpeg (for Docker)
try {
  const ffmpegStatic = await import("ffmpeg-static");
  if (ffmpegStatic.default) {
    ffmpeg.setFfmpegPath(ffmpegStatic.default);
    logger.info("Using ffmpeg-static");
  }
} catch {
  logger.info("Using system FFmpeg");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRAMES_DIR = path.join(__dirname, "..", "frames");
const RENDERED_DIR = path.join(__dirname, "..", "temp", "rendered");

// In-memory render job store (fallback when Redis unavailable)
const renderJobs = new Map();

// Bull queue for render jobs
let renderQueue = null;

/**
 * Process render directly (without queue) - used as fallback
 */
async function processRender(jobId, videoPath, frameId) {
  const outputPath = path.join(RENDERED_DIR, `${jobId}.mp4`);
  const jobData = renderJobs.get(jobId);

  try {
    logger.info({ jobId, frameId }, "Starting render job");

    const framePath = getFramePath(frameId);

    if (!framePath) {
      throw new Error(`Frame "${frameId}" not found`);
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error("Source video not found");
    }

    // Get video dimensions
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const videoStream = metadata.streams.find((s) => s.codec_type === "video");
    if (!videoStream) {
      throw new Error("No video stream found");
    }

    let width = videoStream.width;
    let height = videoStream.height;
    const duration = parseFloat(metadata.format.duration) || 0;

    // Optimize resolution for WhatsApp (max 720p for fast sharing)
    // WhatsApp re-compresses anyway, so smaller = faster upload
    const maxDimension = 720;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale / 2) * 2; // Ensure even dimensions
      height = Math.round(height * scale / 2) * 2;
    }

    // Pre-process frame with Sharp (10x faster than FFmpeg scaling)
    const overlayBuffer = await sharp(framePath)
      .resize(width, height, {
        fit: "cover",
        withoutEnlargement: true,
      })
      .toBuffer();

    // Render with FFmpeg - optimized for FAST sharing (smaller files)
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(overlayBuffer, { format: "rgba" })
        .complexFilter([
          // Scale video down for faster processing + smaller file
          `[0:v]scale=${width}:${height}:flags=fast_bilinear[scaled]`,
          "[1:v]format=rgba[frame]",
          "[scaled][frame]overlay=0:0[out]",
        ])
        .outputOptions([
          "-map", "[out]",
          "-map", "0:a?",
          "-c:v", "libx264",
          "-preset", "veryfast", // Good balance of speed and quality
          "-crf", "30", // Higher = smaller file, faster upload
          "-profile:v", "baseline", // Maximum compatibility
          "-level", "3.0",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "64k", // Lower audio = smaller file
          "-ar", "44100",
          "-ac", "1", // Mono audio for smaller size
          "-movflags", "+faststart",
          "-threads", "0",
          "-maxrate", "2M", // Cap bitrate for smaller files
          "-bufsize", "4M",
        ])
        .output(outputPath)
        .on("progress", (progress) => {
          if (duration > 0 && progress.timemark && jobData) {
            const timeParts = progress.timemark.split(":");
            const seconds =
              parseFloat(timeParts[0]) * 3600 +
              parseFloat(timeParts[1]) * 60 +
              parseFloat(timeParts[2]);
            jobData.progress = Math.min(99, Math.round((seconds / duration) * 100));
          }
        })
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    logger.info({ jobId }, "Render completed");

    if (jobData) {
      jobData.status = "completed";
      jobData.progress = 100;
    }

    return { jobId, status: "completed", outputPath };
  } catch (err) {
    logger.error({ jobId, error: err.message }, "Render failed");

    if (jobData) {
      jobData.status = "failed";
      jobData.error = err.message;
    }

    throw err;
  }
}

/**
 * Initialize render queue (only if Redis is available)
 * @returns {Queue|null}
 */
export function initRenderQueue() {
  if (!isRedisConnected()) {
    logger.info("Running without Redis - using direct processing for renders");
    return null;
  }

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    renderQueue = new Queue("video-renders", redisUrl, {
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
      },
    });

    renderQueue.process(async (job) => {
      const { jobId, videoPath, frameId } = job.data;
      return processRender(jobId, videoPath, frameId);
    });

    renderQueue.on("completed", (job) => {
      logger.info({ jobId: job.id }, "Render job completed");
    });

    renderQueue.on("failed", (job, err) => {
      logger.error({ jobId: job.id, error: err.message }, "Render job failed");
    });

    logger.info("Render queue initialized");
    return renderQueue;
  } catch (err) {
    logger.warn({ error: err.message }, "Failed to initialize render queue");
    return null;
  }
}

/**
 * Get list of available frame templates
 * @returns {Array} - List of frame objects with id, name, preview
 */
export function getAvailableFrames() {
  const frames = [];
  
  if (!fs.existsSync(FRAMES_DIR)) {
    return frames;
  }

  const files = fs.readdirSync(FRAMES_DIR);
  
  for (const file of files) {
    if (file.match(/\.(png|jpg|jpeg)$/i)) {
      const id = path.basename(file, path.extname(file));
      frames.push({
        id,
        name: formatFrameName(id),
        filename: file,
        path: `/api/frames/${file}`,
      });
    }
  }

  return frames;
}

/**
 * Format frame filename into readable name
 */
function formatFrameName(id) {
  return id
    .replace(/^frame-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get path to a specific frame file
 * @param {string} frameId 
 * @returns {string|null}
 */
export function getFramePath(frameId) {
  const extensions = [".png", ".jpg", ".jpeg"];
  
  for (const ext of extensions) {
    const framePath = path.join(FRAMES_DIR, `${frameId}${ext}`);
    if (fs.existsSync(framePath)) {
      return framePath;
    }
  }

  // Try with frame- prefix
  for (const ext of extensions) {
    const framePath = path.join(FRAMES_DIR, `frame-${frameId}${ext}`);
    if (fs.existsSync(framePath)) {
      return framePath;
    }
  }

  return null;
}

/**
 * Start rendering video with frame overlay
 * @param {string} videoPath - Path to source video
 * @param {string} frameId - Frame template ID
 * @returns {object} - Job info with jobId
 */
export async function startRender(videoPath, frameId) {
  const jobId = uuidv4();
  const outputPath = path.join(RENDERED_DIR, `${jobId}.mp4`);
  const framePath = getFramePath(frameId);

  if (!framePath) {
    return { error: `Frame "${frameId}" not found` };
  }

  if (!fs.existsSync(videoPath)) {
    return { error: "Source video not found" };
  }

  const jobData = {
    jobId,
    status: "processing",
    progress: 0,
    outputPath,
    error: null,
    createdAt: Date.now(),
  };

  // Store in memory
  renderJobs.set(jobId, jobData);

  try {
    if (renderQueue) {
      // Add to Bull queue (when Redis is available)
      await renderQueue.add({ jobId, videoPath, frameId });
      logger.info({ jobId, frameId }, "Render job queued");
    } else {
      // Direct processing (no Redis)
      logger.info({ jobId }, "Processing render directly (no queue)");
      processRender(jobId, videoPath, frameId).catch(err => {
        logger.error({ jobId, error: err.message }, "Direct render failed");
      });
    }
  } catch (err) {
    logger.error({ jobId, error: err.message }, "Failed to start render");
    jobData.status = "failed";
    jobData.error = err.message;
  }

  return { jobId, status: "processing" };
}

/**
 * Get the status of a render job
 * @param {string} jobId 
 * @returns {object|null}
 */
export function getRenderStatus(jobId) {
  return renderJobs.get(jobId) || null;
}

/**
 * Get the output path for a completed render job
 * @param {string} jobId 
 * @returns {string|null}
 */
export function getRenderedVideoPath(jobId) {
  const job = renderJobs.get(jobId);
  if (job && job.status === "completed" && fs.existsSync(job.outputPath)) {
    return job.outputPath;
  }
  return null;
}

/**
 * Clean up old render jobs and files
 * @param {number} maxAgeMs - Maximum age in milliseconds
 */
export function cleanupOldRenders(maxAgeMs = 3600000) {
  const now = Date.now();
  const deleted = [];
  
  for (const [jobId, job] of renderJobs.entries()) {
    if (now - job.createdAt > maxAgeMs) {
      if (fs.existsSync(job.outputPath)) {
        try {
          fs.unlinkSync(job.outputPath);
          deleted.push(jobId);
        } catch (err) {
          logger.error({ jobId, error: err.message }, "Failed to delete render file");
        }
      }
      renderJobs.delete(jobId);
    }
  }

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Cleaned up old renders");
  }
}

/**
 * Close render queue
 */
export async function closeRenderQueue() {
  if (renderQueue) {
    await renderQueue.close();
    logger.info("Render queue closed");
  }
}

// Clean up every 30 minutes
setInterval(() => cleanupOldRenders(), 1800000);

export default {
  initRenderQueue,
  getAvailableFrames,
  getFramePath,
  startRender,
  getRenderStatus,
  getRenderedVideoPath,
  cleanupOldRenders,
  closeRenderQueue,
};
