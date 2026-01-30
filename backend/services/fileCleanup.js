/**
 * File Cleanup Service
 * Automatically removes old temporary files
 */

import fs from "fs";
import path from "path";

class FileCleanupService {
  constructor(options = {}) {
    this.dirs = options.dirs || [];
    this.maxAgeMs = options.maxAgeMs || 5 * 60 * 1000; // 5 minutes
    this.intervalMs = options.intervalMs || 5 * 60 * 1000; // Check every 5 minutes
    this.isRunning = false;
    this.interval = null;
  }

  /**
   * Start the cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log("File cleanup service already running");
      return;
    }

    this.isRunning = true;
    console.log(`File cleanup service started (checking every ${this.intervalMs / 1000 / 60} minutes)`);

    // Run cleanup immediately
    this.cleanup();

    // Run cleanup at intervals
    this.interval = setInterval(() => {
      this.cleanup();
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log("File cleanup service stopped");
  }

  /**
   * Perform cleanup
   */
  cleanup() {
    const now = Date.now();
    let totalDeleted = 0;
    let totalSize = 0;

    for (const dir of this.dirs) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;

          // Delete files older than maxAgeMs
          if (fileAge > this.maxAgeMs) {
            try {
              const fileSize = stats.size;
              fs.unlinkSync(filePath);
              totalDeleted++;
              totalSize += fileSize;
              console.log(`[Cleanup] Deleted: ${file} (${this._formatBytes(fileSize)})`);
            } catch (err) {
              console.error(`[Cleanup] Failed to delete ${file}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.error(`[Cleanup] Error reading directory ${dir}:`, err.message);
      }
    }

    if (totalDeleted > 0) {
      console.log(`[Cleanup] Removed ${totalDeleted} files (${this._formatBytes(totalSize)})`);
    }
  }

  /**
   * Format bytes to human-readable
   */
  _formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

export default FileCleanupService;
