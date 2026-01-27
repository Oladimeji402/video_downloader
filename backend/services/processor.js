import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRAMES_DIR = path.join(__dirname, "..", "frames");
const RENDERED_DIR = path.join(__dirname, "..", "temp", "rendered");

// In-memory render job store
const renderJobs = new Map();

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
export function startRender(videoPath, frameId) {
  const jobId = uuidv4();
  const outputPath = path.join(RENDERED_DIR, `${jobId}.mp4`);
  const framePath = getFramePath(frameId);

  if (!framePath) {
    return { error: `Frame "${frameId}" not found` };
  }

  if (!fs.existsSync(videoPath)) {
    return { error: "Source video not found" };
  }

  const job = {
    jobId,
    status: "processing",
    progress: 0,
    outputPath,
    error: null,
    createdAt: Date.now(),
  };

  renderJobs.set(jobId, job);

  // Get video dimensions first, then process
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      job.status = "failed";
      job.error = `Failed to probe video: ${err.message}`;
      return;
    }

    const videoStream = metadata.streams.find((s) => s.codec_type === "video");
    if (!videoStream) {
      job.status = "failed";
      job.error = "No video stream found";
      return;
    }

    const width = videoStream.width;
    const height = videoStream.height;
    const duration = parseFloat(metadata.format.duration) || 0;

    // FFmpeg command to overlay frame on video
    // The frame image will be scaled to match video dimensions
    ffmpeg()
      .input(videoPath)
      .input(framePath)
      .complexFilter([
        // Scale frame to match video size
        `[1:v]scale=${width}:${height}[frame]`,
        // Overlay frame on top of video
        `[0:v][frame]overlay=0:0[out]`
      ])
      .outputOptions([
        "-map", "[out]",
        "-map", "0:a?", // Include audio if present
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("start", (cmd) => {
        console.log("FFmpeg started:", cmd);
      })
      .on("progress", (progress) => {
        if (duration > 0 && progress.timemark) {
          const timeParts = progress.timemark.split(":");
          const seconds = 
            parseFloat(timeParts[0]) * 3600 +
            parseFloat(timeParts[1]) * 60 +
            parseFloat(timeParts[2]);
          job.progress = Math.min(99, Math.round((seconds / duration) * 100));
        }
      })
      .on("end", () => {
        job.status = "completed";
        job.progress = 100;
        console.log(`Render complete: ${jobId}`);
      })
      .on("error", (err) => {
        job.status = "failed";
        job.error = err.message;
        console.error(`Render failed: ${jobId}`, err);
      })
      .run();
  });

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
  
  for (const [jobId, job] of renderJobs.entries()) {
    if (now - job.createdAt > maxAgeMs) {
      if (fs.existsSync(job.outputPath)) {
        try {
          fs.unlinkSync(job.outputPath);
        } catch (err) {
          console.error(`Failed to delete ${job.outputPath}:`, err);
        }
      }
      renderJobs.delete(jobId);
    }
  }
}

// Clean up every 30 minutes
setInterval(() => cleanupOldRenders(), 1800000);

export default {
  getAvailableFrames,
  getFramePath,
  startRender,
  getRenderStatus,
  getRenderedVideoPath,
  cleanupOldRenders,
};
