import ytdl from "ytdl-core";
import Queue from "bull";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import logger from "./logger.js";
import { isRedisConnected } from "./redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOADS_DIR = path.join(__dirname, "..", "temp", "downloads");

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// In-memory job store (fallback when Redis is not available)
const downloadJobs = new Map();

// Bull queue for download jobs
let downloadQueue = null;

/**
 * Download video directly (without queue) - used as fallback
 */
async function processDownload(videoId, url) {
  const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.mp4`);
  const jobData = downloadJobs.get(videoId);

  try {
    logger.info({ videoId, url }, "Starting video download");

    // Check if ytdl-core supports this URL (YouTube only)
    if (ytdl.validateURL(url)) {
      const videoInfo = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(videoInfo.formats, {
        quality: "highest",
        filter: (format) => format.container === "mp4",
      });

      if (!format) {
        throw new Error("No suitable video format found");
      }

      const stream = ytdl(url, { format });
      const writeStream = fs.createWriteStream(outputPath);

      let downloadedBytes = 0;
      const totalBytes = parseInt(format.contentLength, 10) || 0;

      stream.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && jobData) {
          jobData.progress = Math.round((downloadedBytes / totalBytes) * 100);
        }
      });

      await new Promise((resolve, reject) => {
        stream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        stream.on("error", reject);
      });
    } else {
      // Fallback to yt-dlp for non-YouTube URLs (TikTok, Instagram, etc.)
      const { spawn } = await import("child_process");
      
      await new Promise((resolve, reject) => {
        const ytdlp = spawn("yt-dlp", [
          "-f", "mp4/best[ext=mp4]/best",
          "--merge-output-format", "mp4",
          "-o", outputPath,
          "--newline",
          "--progress",
          url
        ]);

        let stderr = "";

        ytdlp.stdout.on("data", (data) => {
          const output = data.toString();
          const progressMatch = output.match(/(\d+\.?\d*)%/);
          if (progressMatch && jobData) {
            jobData.progress = parseFloat(progressMatch[1]);
          }
        });

        ytdlp.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        ytdlp.on("close", (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve();
          } else {
            reject(new Error(stderr || `yt-dlp exited with code ${code}`));
          }
        });

        ytdlp.on("error", reject);
      });
    }

    logger.info({ videoId }, "Download completed");

    if (jobData) {
      jobData.status = "completed";
      jobData.progress = 100;
    }

    return { videoId, status: "completed", outputPath };
  } catch (err) {
    logger.error({ videoId, error: err.message }, "Download failed");

    if (jobData) {
      jobData.status = "failed";
      jobData.error = err.message;
    }

    throw err;
  }
}

/**
 * Initialize download queue (only if Redis is available)
 * @returns {Queue|null}
 */
export function initDownloadQueue() {
  if (!isRedisConnected()) {
    logger.info("Running without Redis - using direct processing for downloads");
    return null;
  }

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    downloadQueue = new Queue("video-downloads", redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
      },
    });

    downloadQueue.process(async (job) => {
      const { videoId, url } = job.data;
      return processDownload(videoId, url);
    });

    downloadQueue.on("completed", (job) => {
      logger.info({ jobId: job.id }, "Download job completed");
    });

    downloadQueue.on("failed", (job, err) => {
      logger.error({ jobId: job.id, error: err.message }, "Download job failed");
    });

    logger.info("Download queue initialized");
    return downloadQueue;
  } catch (err) {
    logger.warn({ error: err.message }, "Failed to initialize download queue");
    return null;
  }
}

/**
 * Start downloading a video from a social media URL
 * @param {string} url - The video URL
 * @returns {object} - Job info with videoId
 */
export async function startDownload(url) {
  const videoId = uuidv4();

  const jobData = {
    videoId,
    url,
    status: "downloading",
    progress: 0,
    outputPath: path.join(DOWNLOADS_DIR, `${videoId}.mp4`),
    error: null,
    createdAt: Date.now(),
  };

  // Store in memory
  downloadJobs.set(videoId, jobData);

  try {
    if (downloadQueue) {
      // Add to Bull queue (when Redis is available)
      await downloadQueue.add({ videoId, url });
      logger.info({ videoId, url }, "Download job queued");
    } else {
      // Direct processing (no Redis)
      logger.info({ videoId }, "Processing download directly (no queue)");
      processDownload(videoId, url).catch(err => {
        logger.error({ videoId, error: err.message }, "Direct download failed");
      });
    }
  } catch (err) {
    logger.error({ videoId, error: err.message }, "Failed to start download");
    jobData.status = "failed";
    jobData.error = err.message;
  }

  return { videoId, status: "downloading" };
}

/**
 * Get the status of a download job
 * @param {string} videoId 
 * @returns {object|null}
 */
export function getDownloadStatus(videoId) {
  return downloadJobs.get(videoId) || null;
}

/**
 * Get the file path for a downloaded video
 * @param {string} videoId 
 * @returns {string|null}
 */
export function getVideoPath(videoId) {
  const job = downloadJobs.get(videoId);
  if (job && job.status === "completed" && fs.existsSync(job.outputPath)) {
    return job.outputPath;
  }
  return null;
}

/**
 * Handle uploaded video file
 * @param {object} file - Multer file object
 * @returns {object} - Job info with videoId
 */
export function handleUploadedFile(file) {
  if (!file) {
    return { error: "No file provided" };
  }

  const videoId = uuidv4();
  const uploadsDir = path.join(__dirname, "..", "temp", "uploads");
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Use a clean filename with just the videoId
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`);

  // Copy uploaded file to outputs directory
  try {
    fs.copyFileSync(file.path, outputPath);
    
    const job = {
      videoId,
      status: "completed",
      progress: 100,
      outputPath,
      error: null,
      createdAt: Date.now(),
      isUploaded: true,
    };

    downloadJobs.set(videoId, job);

    // Clean up the temp multer file
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      logger.error({ error: err.message }, "Failed to delete temp file");
    }

    logger.info({ videoId, outputPath }, "File uploaded successfully");
    return { videoId, status: "completed" };
  } catch (err) {
    logger.error({ error: err.message }, "Error handling uploaded file");
    return { error: err.message };
  }
}

/**
 * Clean up old download jobs and files (call periodically)
 * @param {number} maxAgeMs - Maximum age in milliseconds
 */
export function cleanupOldDownloads(maxAgeMs = 3600000) { // Default: 1 hour
  const now = Date.now();
  const deleted = [];
  
  for (const [videoId, job] of downloadJobs.entries()) {
    if (now - job.createdAt > maxAgeMs) {
      // Delete the file if it exists
      if (fs.existsSync(job.outputPath)) {
        try {
          fs.unlinkSync(job.outputPath);
          deleted.push(videoId);
        } catch (err) {
          logger.error({ videoId, error: err.message }, "Failed to delete download file");
        }
      }
      downloadJobs.delete(videoId);
    }
  }

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Cleaned up old downloads");
  }
}

/**
 * Close download queue
 */
export async function closeDownloadQueue() {
  if (downloadQueue) {
    await downloadQueue.close();
    logger.info("Download queue closed");
  }
}

// Clean up every 30 minutes
setInterval(() => cleanupOldDownloads(), 1800000);

export default {
  initDownloadQueue,
  startDownload,
  handleUploadedFile,
  getDownloadStatus,
  getVideoPath,
  cleanupOldDownloads,
  closeDownloadQueue,
};
