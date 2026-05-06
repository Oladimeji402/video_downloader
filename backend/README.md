# Backend - VideoFramer API

Express.js backend for video downloading, processing, and frame overlay rendering.

## Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:4000`

## Architecture

### Services

- **downloader.js** - Handles video downloads from social media URLs using yt-dlp
- **processor.js** - FFmpeg-based video processing and frame overlay rendering
- **redis.js** - Optional Redis connection for job queues (falls back to in-memory)
- **rateLimiter.js** - Rate limiting (20 requests/hour per IP)
- **fileCleanup.js** - Automatic cleanup of temp files (30min TTL)
- **logger.js** - Pino-based structured logging

### Routes

- **video.routes.js** - All API endpoints for video operations

## API Endpoints

### Video Download
- `POST /api/video/resolve` - Start download from URL
- `POST /api/video/upload` - Upload video file (max 500MB)
- `GET /api/video/status/:videoId` - Check download progress
- `GET /api/video/preview/:videoId` - Stream video for preview

### Frame Management
- `GET /api/frames` - List available frame templates
- `GET /api/frames/:filename` - Serve frame image

### Video Rendering
- `POST /api/video/render` - Start rendering with frame overlay
- `GET /api/video/render/:jobId` - Check render progress
- `GET /api/video/download/:jobId` - Download rendered video

### Health
- `GET /api/health` - Server health check

## Environment Variables

```bash
PORT=4000                    # Server port
REDIS_URL=redis://localhost:6379  # Optional Redis connection
```

## Dependencies

### Required System Tools
- **FFmpeg** - Video processing
- **yt-dlp** - Social media video downloads

### Node Packages
- express - Web framework
- fluent-ffmpeg - FFmpeg wrapper
- sharp - Image processing
- ytdl-core - YouTube downloads
- bull - Job queue (requires Redis)
- multer - File uploads
- pino - Logging

## Performance Optimizations

1. **Resolution capping** - Videos scaled to max 720p for faster processing
2. **FFmpeg preset** - Uses "ultrafast" for quick encoding
3. **Sharp preprocessing** - Frame images processed with Sharp (10x faster than FFmpeg)
4. **In-memory fallback** - Works without Redis for small deployments
5. **File cleanup** - Automatic deletion of files older than 30 minutes

## Adding Custom Frames

1. Create PNG with transparent center
2. Place in `backend/frames/` directory
3. Name format: `frame-{name}.png` or `{name}.png`
4. Restart server or wait for auto-reload

## Troubleshooting

### FFmpeg Issues
- Ensure FFmpeg is in PATH: `ffmpeg -version`
- Check logs for FFmpeg errors
- Verify video codec compatibility

### yt-dlp Issues
- Update: `pip install -U yt-dlp`
- Check platform support
- Some videos may be geo-restricted

### Performance Issues
- Enable Redis for better queue management
- Reduce video resolution cap in processor.js
- Increase file cleanup interval
- Check server resources (CPU/RAM)

## File Structure

```
backend/
├── index.js              # Server entry point
├── routes/
│   └── video.routes.js   # API routes
├── services/
│   ├── downloader.js     # Video downloads
│   ├── processor.js      # Video processing
│   ├── redis.js          # Redis connection
│   ├── rateLimiter.js    # Rate limiting
│   ├── fileCleanup.js    # Temp file cleanup
│   └── logger.js         # Logging
├── frames/               # Frame templates (PNG)
├── temp/
│   ├── downloads/        # Downloaded videos
│   ├── uploads/          # Uploaded videos
│   └── rendered/         # Rendered outputs
└── scripts/
    └── generate-frames.js # Frame generator
```

## Deployment

See main README.md for deployment instructions to Render, Railway, or Fly.io.
