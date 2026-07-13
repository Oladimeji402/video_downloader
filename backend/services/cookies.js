import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COOKIES_PATH = path.join(__dirname, "..", "temp", "instagram-cookies.txt");

/**
 * Write Instagram cookies from env to a temp file for yt-dlp.
 * Supports INSTAGRAM_COOKIES (raw Netscape format) or INSTAGRAM_COOKIES_B64.
 * @returns {string|null} Path to cookies file, or null if not configured
 */
export function initInstagramCookies() {
  const raw = process.env.INSTAGRAM_COOKIES;
  const encoded = process.env.INSTAGRAM_COOKIES_B64;

  if (!raw && !encoded) {
    logger.info("Instagram cookies not configured — URL downloads are best-effort");
    return null;
  }

  try {
    let content = raw;

    if (!content && encoded) {
      content = Buffer.from(encoded, "base64").toString("utf8");
    }

    if (!content?.trim()) {
      logger.warn("Instagram cookies env var is empty");
      return null;
    }

    const tempDir = path.dirname(COOKIES_PATH);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(COOKIES_PATH, content.trim() + "\n", { mode: 0o600 });
    logger.info("Instagram cookies loaded for yt-dlp");
    return COOKIES_PATH;
  } catch (err) {
    logger.error({ error: err.message }, "Failed to write Instagram cookies");
    return null;
  }
}

export function getInstagramCookiesPath() {
  if (fs.existsSync(COOKIES_PATH)) {
    return COOKIES_PATH;
  }
  return null;
}
