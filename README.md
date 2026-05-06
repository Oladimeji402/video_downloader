# 🎬 VideoFramer

Add beautiful frames to TikTok, Instagram, and other social media videos.

## Features

- 📥 **Fetch videos** from TikTok, Instagram, YouTube, Twitter, and Facebook
- 📤 **Upload videos** directly (max 500MB)
- 🖼️ **Frame overlays** - Add custom PNG frame templates on top of videos
- 🎨 **Frame selection** - Choose from multiple frame styles
- ⚡ **FFmpeg processing** - Server-side video rendering with Sharp preprocessing
- 📊 **Progress tracking** - Real-time download and render progress
- 🚀 **Background pre-rendering** - Instant downloads with smart caching
- 📱 **Share options** - Native share, WhatsApp, copy link
- 💾 **Easy download** - Get your framed video as a single merged file

## Prerequisites

Before running this application, ensure you have:

- **Node.js** (v18 or higher)
- **FFmpeg** installed and available in PATH
- **yt-dlp** installed and available in PATH

### Installing FFmpeg

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update && sudo apt install ffmpeg
```

### Installing yt-dlp

```bash
# Using pip
pip install yt-dlp

# Or download from https://github.com/yt-dlp/yt-dlp/releases
```

## Installation

1. **Clone or download** this repository

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **(Optional) Generate sample frames:**
   ```bash
   npm install canvas
   node scripts/generate-frames.js
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in browser:**
   ```
   http://localhost:4000
   ```

## Project Structure

```
frame/
├── backend/
│   ├── index.js              # Express server entry point
│   ├── routes/
│   │   └── video.routes.js   # API route handlers
│   ├── services/
│   │   ├── downloader.js     # yt-dlp video downloading
│   │   └── processor.js      # FFmpeg video processing
│   ├── frames/               # Frame PNG templates
│   ├── temp/
│   │   ├── downloads/        # Downloaded source videos
│   │   └── rendered/         # Processed output videos
│   ├── scripts/
│   │   └── generate-frames.js
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/video/resolve` | Start downloading video from URL |
| `GET` | `/api/video/status/:videoId` | Check download status |
| `GET` | `/api/video/preview/:videoId` | Stream downloaded video |
| `GET` | `/api/frames` | List available frame templates |
| `GET` | `/api/frames/:filename` | Get frame image |
| `POST` | `/api/video/render` | Start rendering with frame overlay |
| `GET` | `/api/video/render/:jobId` | Check render status |
| `GET` | `/api/video/download/:jobId` | Download rendered video |

## Adding Custom Frames

1. Create a PNG image with a **transparent center**
2. Name it `frame-{name}.png` (e.g., `frame-custom.png`)
3. Place it in `backend/frames/`
4. Refresh the app to see your new frame

### Frame Requirements

- **Format:** PNG with alpha transparency
- **Size:** Any size (will be scaled to match video)
- **Center:** Must be transparent where video shows through

## Data Flow

```
User pastes URL
    ↓
POST /api/video/resolve → yt-dlp downloads video → Returns videoId
    ↓
Frontend polls /api/video/status/:videoId until complete
    ↓
GET /api/video/preview/:videoId → Video player shows preview
    ↓
User selects frame from /api/frames
    ↓
User clicks Download
    ↓
POST /api/video/render → FFmpeg overlays frame → Returns jobId
    ↓
Frontend polls /api/video/render/:jobId until complete
    ↓
GET /api/video/download/:jobId → User downloads merged video
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |

## Performance

### Optimizations
- **Resolution capping** - Videos scaled to 720p for faster processing
- **Sharp preprocessing** - Frame images processed 10x faster than FFmpeg alone
- **Background pre-rendering** - Renders start when frame is selected
- **In-memory fallback** - Works without Redis for simple deployments
- **Automatic cleanup** - Files deleted after 30 minutes

### Known Issues
- **Long videos (>2min)** may take 3-4 minutes to render
- **TikTok videos** may be slower due to download time
- **Cold starts** on free hosting can take 30-60 seconds

### Improving Performance
1. Enable Redis for better queue management
2. Reduce resolution cap in `backend/services/processor.js`
3. Use faster hosting with more CPU/RAM
4. Limit video duration on upload

## Troubleshooting

### "yt-dlp not found"
Ensure yt-dlp is installed and available in your system PATH.

### "FFmpeg not found"
Ensure FFmpeg is installed and available in your system PATH.

### Video download fails
Some platforms may block downloads. Try updating yt-dlp:
```bash
pip install -U yt-dlp
```

### Frame not showing in preview
Ensure your frame PNG has a transparent center and is named correctly.

### Rendering takes too long
- Check video duration (longer videos = longer render time)
- Verify FFmpeg is using hardware acceleration if available
- Check server CPU usage
- Consider reducing resolution cap

## Documentation

- **Backend** - See `backend/README.md` for API details
- **Frontend** - See `frontend/README.md` for UI details
- **Deployment** - See `DEPLOYMENT.md` for hosting instructions

## License

MIT License - feel free to use and modify!

---

Built with ❤️ using Node.js, Express, FFmpeg, Sharp, and yt-dlp
