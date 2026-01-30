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

// Initialize file cleanup service (cleanup every 5 minutes, delete files older than 5 minutes)
const fileCleanup = new FileCleanupService({
  dirs: [downloadsDir, renderedDir, uploadsDir],
  maxAgeMs: 5 * 60 * 1000, // 5 minutes
  intervalMs: 5 * 60 * 1000, // Check every 5 minutes
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
app.use("/api/video", (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  
  if (!rateLimiter.isAllowed(ip)) {
    const resetTime = rateLimiter.getResetTime(ip);
    return res.status(429).json({
      success: false,
      error: "Too many requests. Rate limit: 20 videos per hour.",
      retryAfter: resetTime,
      retryAfterSeconds: resetTime,
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
