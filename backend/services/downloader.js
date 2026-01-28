import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOADS_DIR = path.join(__dirname, "..", "temp", "downloads");

// In-memory job store (in production, use Redis or a database)
const downloadJobs = new Map();

/**
 * Start downloading a video from a social media URL
 * @param {string} url - The TikTok/Instagram video URL
 * @returns {object} - Job info with videoId
 */
export function startDownload(url) {
  const videoId = uuidv4();
  const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.mp4`);

  const job = {
    videoId,
    url,
    status: "downloading",
    progress: 0,
    outputPath,
    error: null,
    createdAt: Date.now(),
  };

  downloadJobs.set(videoId, job);

  // Use yt-dlp with progress output
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
    // Parse progress from yt-dlp output
    const progressMatch = output.match(/(\d+\.?\d*)%/);
    if (progressMatch) {
      job.progress = parseFloat(progressMatch[1]);
    }
  });

  ytdlp.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  ytdlp.on("close", (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      job.status = "completed";
      job.progress = 100;
    } else {
      job.status = "failed";
      job.error = stderr || `yt-dlp exited with code ${code}`;
    }
  });

  ytdlp.on("error", (err) => {
    job.status = "failed";
    job.error = err.message;
  });

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
      console.error("Failed to delete temp file:", err);
    }

    console.log(`Uploaded video stored at: ${outputPath}`);
    return { videoId, status: "completed" };
  } catch (err) {
    console.error("Error handling uploaded file:", err);
    return { error: err.message };
  }
}

/**
 * Clean up old download jobs and files (call periodically)
 * @param {number} maxAgeMs - Maximum age in milliseconds
 */
export function cleanupOldDownloads(maxAgeMs = 3600000) { // Default: 1 hour
  const now = Date.now();
  
  for (const [videoId, job] of downloadJobs.entries()) {
    if (now - job.createdAt > maxAgeMs) {
      // Delete the file if it exists
      if (fs.existsSync(job.outputPath)) {
        try {
          fs.unlinkSync(job.outputPath);
        } catch (err) {
          console.error(`Failed to delete ${job.outputPath}:`, err);
        }
      }
      downloadJobs.delete(videoId);
    }
  }
}

// Clean up every 30 minutes
setInterval(() => cleanupOldDownloads(), 1800000);

export default {
  startDownload,
  handleUploadedFile,
  getDownloadStatus,
  getVideoPath,
  cleanupOldDownloads,
};
