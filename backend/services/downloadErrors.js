/**
 * Parse yt-dlp errors into user-friendly messages.
 * Raw stderr is kept server-side only; clients get sanitized text.
 */

const PLATFORMS = {
  instagram: { name: "Instagram", domains: ["instagram.com"] },
  tiktok: { name: "TikTok", domains: ["tiktok.com"] },
  youtube: { name: "YouTube", domains: ["youtube.com", "youtu.be"] },
  twitter: { name: "X/Twitter", domains: ["twitter.com", "x.com"] },
  facebook: { name: "Facebook", domains: ["facebook.com", "fb.watch"] },
};

export function detectPlatform(url) {
  if (!url || typeof url !== "string") return null;

  for (const [id, { domains }] of Object.entries(PLATFORMS)) {
    if (domains.some((domain) => url.includes(domain))) {
      return id;
    }
  }

  return null;
}

export function getPlatformName(platform) {
  return PLATFORMS[platform]?.name || "this platform";
}

/**
 * @param {string} stderr
 * @param {string|null} platform
 * @returns {{ message: string, errorCode: string, suggestUpload: boolean, platform: string|null }}
 */
export function parseDownloadError(stderr, platform = null) {
  const output = (stderr || "").toLowerCase();
  const platformName = getPlatformName(platform);

  if (platform === "instagram" || output.includes("[instagram]")) {
    if (
      output.includes("login required") ||
      output.includes("locked behind the login page") ||
      output.includes("rate-limit") ||
      output.includes("rate limit") ||
      output.includes("not available")
    ) {
      return {
        message:
          "Instagram blocked this download. Save the reel to your phone and upload the video file instead.",
        errorCode: "INSTAGRAM_AUTH_REQUIRED",
        suggestUpload: true,
        platform: "instagram",
      };
    }

    // Instagram returns an empty media response when the post requires login
    // or when yt-dlp is outdated / the API has changed
    if (
      output.includes("empty media response") ||
      output.includes("empty response") ||
      output.includes("sent an empty") ||
      output.includes("no media") ||
      output.includes("no formats found") ||
      output.includes("unable to extract")
    ) {
      return {
        message:
          "Instagram links often fail — save the reel and upload instead.",
        errorCode: "INSTAGRAM_EMPTY_RESPONSE",
        suggestUpload: true,
        platform: "instagram",
      };
    }

    if (output.includes("private") || output.includes("not found")) {
      return {
        message: "This Instagram post is private, deleted, or unavailable.",
        errorCode: "INSTAGRAM_UNAVAILABLE",
        suggestUpload: true,
        platform: "instagram",
      };
    }
  }

  if (platform === "tiktok" || output.includes("[tiktok]")) {
    if (
      output.includes("unable to extract") ||
      output.includes("webpage video data") ||
      output.includes("impersonat")
    ) {
      return {
        message: "TikTok blocked this download. Save the video to your phone and upload the file instead.",
        errorCode: "TIKTOK_EXTRACT_FAILED",
        suggestUpload: true,
        platform: "tiktok",
      };
    }
  }

  if (output.includes("rate limit") || output.includes("rate-limit") || output.includes("429")) {
    return {
      message: `${platformName} is rate-limiting requests. Wait a few minutes or upload the video file instead.`,
      errorCode: "RATE_LIMITED",
      suggestUpload: true,
      platform,
    };
  }

  if (output.includes("private") || output.includes("sign in")) {
    return {
      message: `This ${platformName} video is private or requires login. Try uploading the video file instead.`,
      errorCode: "AUTH_REQUIRED",
      suggestUpload: true,
      platform,
    };
  }

  if (output.includes("not found") || output.includes("unavailable") || output.includes("does not exist")) {
    return {
      message: "Video not found. The link may be broken or the post was removed.",
      errorCode: "NOT_FOUND",
      suggestUpload: platform === "instagram",
      platform,
    };
  }

  if (output.includes("max-filesize") || output.includes("file is larger than")) {
    return {
      message: "Video is too large (max 200MB). Try a shorter clip or upload a smaller file.",
      errorCode: "FILE_TOO_LARGE",
      suggestUpload: false,
      platform,
    };
  }

  // For Instagram, always suggest the upload path — URL downloads are unreliable
  if (platform === "instagram") {
    return {
      message: "Instagram links often fail — save the reel and upload instead.",
      errorCode: "DOWNLOAD_FAILED",
      suggestUpload: true,
      platform,
    };
  }

  return {
    message: `Could not download this ${platformName} video. Try uploading the file instead.`,
    errorCode: "DOWNLOAD_FAILED",
    suggestUpload: platform === "instagram" || platform === "tiktok",
    platform,
  };
}
