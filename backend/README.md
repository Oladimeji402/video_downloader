# Backend - Video Framer API

Express.js backend for video downloading, processing, and frame overlay.

## Dependencies

- **express**: Web server
- **fluent-ffmpeg**: Video processing
- **ytdl-core**: YouTube downloads
- **yt-dlp**: Multi-platform video downloads (TikTok, Instagram, etc.)
- **sharp**: Image processing
- **bull**: Job queue (requires Redis, optional)
- **multer**: File uploads

## API Endpoints

### Video Operations
- `POST /api/video/resolve` - Start video download from URL
- `POST /api/video/upload` - Upload video file
- `GET /api/video/status/:id` - Check download status
- `GET /api/video/preview/:id` - Stream video

### Frame Operations
- `GET /api/frames` - List available frame templates
- `GET /api/frames/:filename` - Get frame image

### Render Operations
- `POST /api/video/render` - Start frame overlay rendering
- `GET /api/video/render/:jobId` - Check render status
- `GET /api/video/download/:jobId` - Download rendered video

### Health
- `GET /api/health` - Server health check

## Environment Variables

```bash
PORT=4000                    # Server port
REDIS_URL=redis://...       # Optional: Redis for job queue
NODE_OPTIONS=--max-old-space-size=450  # Memory limit for free tier
```

## Performance Settings

Optimized for **512MB RAM free tier hosting**:
- Resolution: 270p max
- FFmpeg preset: faster
- Audio bitrate: 64k
- Buffer size: 1MB
- Max video duration: 120 seconds (2 minutes)
- Thread limit: 2

## File Cleanup

Automatic cleanup runs every 10 minutes:
- Deletes files older than 30 minutes
- Cleans downloads, renders, and uploads folders

## Rate Limiting

- 20 expensive operations per hour per IP
- Only applies to: resolve, upload, render
- Does NOT apply to: status checks, streaming, frame lists

## Running Locally

```bash
npm install
npm start
```

Server runs on http://localhost:4000

## Upgrading Performance

For paid hosting with 2GB+ RAM, edit `services/processor.js`:

```javascript
// Increase resolution
const maxDimension = 540; // or 720 for HD

// Remove duration limit
// Comment out the duration check

// Better quality preset
"-preset", "veryfast"  // instead of "faster"
"-crf", "23"            // instead of "30"
```

## Deployment

Designed for:
- Render (free or paid)
- Railway
- Fly.io
- Any Node.js hosting with FFmpeg support

Ensure FFmpeg and yt-dlp are available in the environment.
