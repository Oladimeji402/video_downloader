import Queue from "bull";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { spawn, execFile } from "child_process";
import logger from "./logger.js";
import { isRedisConnected } from "./redis.js";
import { detectPlatform, parseDownloadError } from "./downloadErrors.js";
import { getInstagramCookiesPath } from "./cookies.js";

const DOWNLOAD_TIMEOUT_MS = 4 * 60 * 1000;

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
 * Attempt to self-update yt-dlp via pip at startup.
 * Runs fire-and-forget — a failure here is non-fatal.
 */
export function updateYtDlp() {
  // Only run in production (skip in local dev to save time)
  if (process.env.NODE_ENV !== "production") {
    logger.info("Skipping yt-dlp auto-update in non-production environment");
    return;
  }

  logger.info("Attempting yt-dlp self-update via pip...");

  // Try pip3 first, fall back to pip
  const tryUpdate = (cmd, args) => {
    return new Promise((resolve) => {
      const proc = execFile(cmd, args, { timeout: 60_000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, output: stderr || err.message });
        } else {
          resolve({ ok: true, output: stdout });
        }
      });
      proc.on("error", () => resolve({ ok: false, output: "command not found" }));
    });
  };

  (async () => {
    // First try: pip3 upgrade
    let result = await tryUpdate("pip3", ["install", "--upgrade", "--no-cache-dir", "yt-dlp"]);

    if (!result.ok) {
      // Second try: pip
      result = await tryUpdate("pip", ["install", "--upgrade", "--no-cache-dir", "yt-dlp"]);
    }

    if (result.ok) {
      logger.info("yt-dlp updated successfully");
    } else {
      // Not fatal — deployed image may already be recent enough, or pip unavailable
      logger.warn({ output: result.output }, "yt-dlp auto-update failed (non-fatal)");
    }
  })();
}

function buildYtDlpArgs(outputPath, url) {
  const platform = detectPlatform(url);

  // Fast path: one already-muxed 1080p MP4 (typical TikTok/Reels) — no ffmpeg merge.
  // Require both edges >= 1080 so we never pick a 360p/540p "best combined" file.
  // Fallback merges video+audio when the site only splits streams (YouTube, some IG).
  const args = [
    "-f", "b[ext=mp4][width>=1080][height>=1080]/bv*[width<=1920][height<=1920]+ba/b[width<=1920][height<=1920]/bv*+ba/b",
    "-S", "res:1080,codec:h264:m4a,ext:mp4:m4a",
    "--merge-output-format", "mp4",
    "-o", outputPath,
    "--newline",
    "--progress",
    "--no-playlist",
    "--no-mtime",
    "--no-update",
    "--no-warnings",
    "--retries", "5",
    "--fragment-retries", "5",
    "--concurrent-fragments", "4",
    "--buffer-size", "1M",
    "--throttled-rate", "100K",
    "--socket-timeout", "20",
    "--max-filesize", "200M",
  ];

  if (platform === "tiktok") {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--add-header", "Origin:https://www.tiktok.com");
    // Helps non-US hosts see the 1080p format list instead of a single low `play` stream
    args.push("--xff", "US");
  }

  if (platform === "instagram") {
    args.push("--add-header", "Referer:https://www.instagram.com/");
    const cookiesPath = getInstagramCookiesPath();
    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    }
  }

  args.push("--", url);
  return args;
}

function parseYtDlpProgress(chunk, jobData) {
  if (!jobData) return;
  const match = chunk.toString().match(/(\d+\.?\d*)%/);
  if (match) {
    jobData.progress = Math.min(99, parseFloat(match[1]));
  }
}

function setDownloadFailure(jobData, url, stderr) {
  const platform = detectPlatform(url);
  const parsed = parseDownloadError(stderr, platform);

  if (jobData) {
    jobData.status = "failed";
    jobData.error = parsed.message;
    jobData.errorCode = parsed.errorCode;
    jobData.suggestUpload = parsed.suggestUpload;
    jobData.platform = parsed.platform;
  }

  return parsed;
}

/**
 * Download video directly (without queue) - used as fallback
 */
async function processDownload(videoId, url) {
  const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.mp4`);
  const jobData = downloadJobs.get(videoId);

  try {
    logger.info({ videoId, url, platform: detectPlatform(url) }, "Starting video download");

    await new Promise((resolve, reject) => {
      const ytdlp = spawn("yt-dlp", buildYtDlpArgs(outputPath, url));

      let stderr = "";
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        ytdlp.kill("SIGKILL");
        const parsed = setDownloadFailure(jobData, url, "Download timed out");
        reject(new Error(parsed.message));
      }, DOWNLOAD_TIMEOUT_MS);

      const finish = (fn) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      ytdlp.stdout.on("data", (data) => parseYtDlpProgress(data, jobData));
      ytdlp.stderr.on("data", (data) => {
        stderr += data.toString();
        parseYtDlpProgress(data, jobData);
      });

      ytdlp.on("close", (code) => {
        finish(() => {
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve();
          } else {
            const parsed = setDownloadFailure(jobData, url, stderr);
            logger.error(
              { videoId, platform: parsed.platform, errorCode: parsed.errorCode },
              "yt-dlp download failed"
            );
            reject(new Error(parsed.message));
          }
        });
      });

      ytdlp.on("error", (err) => {
        finish(() => {
          const parsed = setDownloadFailure(jobData, url, err.message);
          reject(new Error(parsed.message));
        });
      });
    });

    logger.info({ videoId }, "Download completed");

    if (jobData) {
      jobData.status = "completed";
      jobData.progress = 100;
    }

    return { videoId, status: "completed", outputPath };
  } catch (err) {
    logger.error({ videoId, error: err.message }, "Download failed");

    if (jobData && jobData.status !== "failed") {
      const parsed = setDownloadFailure(jobData, url, err.message);
      throw new Error(parsed.message);
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
    errorCode: null,
    suggestUpload: false,
    platform: detectPlatform(url),
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
