import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import videoRoutes from "./routes/video.routes.js";
import RateLimiter from "./services/rateLimiter.js";
import FileCleanupService from "./services/fileCleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directories exist
const tempDir = path.join(__dirname, "temp");
const downloadsDir = path.join(tempDir, "downloads");
const renderedDir = path.join(tempDir, "rendered");
const uploadsDir = path.join(tempDir, "uploads");

[tempDir, downloadsDir, renderedDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize rate limiter (20 requests per hour)
const rateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// Initialize file cleanup service (cleanup every 10 minutes, delete files older than 30 minutes)
// Increased TTL to give users more time to select frames and share
const fileCleanup = new FileCleanupService({
  dirs: [downloadsDir, renderedDir, uploadsDir],
  maxAgeMs: 30 * 60 * 1000, // 30 minutes (was 5 - too aggressive)
  intervalMs: 10 * 60 * 1000, // Check every 10 minutes
});

// Start file cleanup service
fileCleanup.start();

// Cleanup on shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  fileCleanup.stop();
  process.exit(0);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Rate limiting middleware for video endpoints
// ONLY rate limit expensive operations (downloads/renders), NOT status polling or streaming
app.use("/api/video", (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  
  // Only rate limit expensive operations that actually process videos
  const expensiveOperations = [
    { path: "/resolve", method: "POST" },
    { path: "/upload", method: "POST" },
    { path: "/render", method: "POST" },
  ];
  
  const isExpensive = expensiveOperations.some(
    op => req.path === op.path && req.method === op.method
  );
  
  if (isExpensive && !rateLimiter.isAllowed(ip)) {
    const resetTime = rateLimiter.getResetTime(ip);
    const remaining = rateLimiter.getRemaining(ip);
    const minutesUntilReset = Math.ceil(resetTime / 60);
    
    return res.status(429).json({
      success: false,
      error: `Rate limit reached. You can process ${rateLimiter.maxRequests} videos per hour. Try again in ${minutesUntilReset} minute${minutesUntilReset === 1 ? '' : 's'}.`,
      retryAfter: resetTime,
      retryAfterSeconds: resetTime,
      remaining: remaining,
    });
  }
  
  next();
});

// API Routes
app.use("/api/video", videoRoutes);
app.use("/api", videoRoutes); // Also mount at /api for frame routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Video Framer API is running",
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                   VIDEO FRAMER SERVER                     ║
╠══════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}               ║
║                                                          ║
║  API Endpoints:                                          ║
║  - POST /api/video/resolve    - Fetch video from URL     ║
║  - POST /api/video/upload     - Upload video file        ║
║  - GET  /api/video/status/:id - Check download status    ║
║  - GET  /api/video/preview/:id- Preview downloaded video ║
║  - GET  /api/frames           - List frame templates     ║
║  - POST /api/video/render     - Render with frame        ║
║  - GET  /api/video/render/:id - Check render status      ║
║  - GET  /api/video/download/:id - Download rendered      ║
╚══════════════════════════════════════════════════════════╝
  `);
});
