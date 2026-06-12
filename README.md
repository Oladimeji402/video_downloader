# 🎬 Video Framer - Social Media Video Frame Overlay Tool

Add stylish frames to your TikTok, Instagram, YouTube videos instantly!

## Features

- ✅ Download videos from TikTok, Instagram, YouTube, Twitter, Facebook
- ✅ Add custom frame overlays
- ✅ 270p resolution (optimized for free hosting speed)
- ✅ iPhone/mobile optimized
- ✅ Native share API for iOS
- ✅ 2-minute video limit (free tier)

## Tech Stack

**Backend:**
- Node.js + Express
- FFmpeg for video processing
- yt-dlp for video downloads
- Bull queue for job processing (optional Redis)

**Frontend:**
- Vanilla JavaScript
- Responsive CSS
- Native Web Share API

## Setup

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
Open `frontend/index.html` in browser or deploy to static hosting.

## Deployment

Currently deployed on:
- **Backend**: Render (free tier)
- **Frontend**: Vercel

## Performance

**Free Tier (Current):**
- 30-second video: ~30-45 seconds
- 1-minute video: ~60-90 seconds
- 2-minute video: ~2-3 minutes

**With Paid Hosting ($7/mo):**
- 30-second video: ~15-25 seconds
- 1-minute video: ~30-45 seconds
- 2-minute video: ~60-90 seconds
- No duration limits
- Better quality (540p+)

## Optimization Notes

This app is optimized for **free tier hosting** with limited resources:
- Resolution capped at 270p (faster processing)
- 2-minute video duration limit
- Aggressive file compression
- Lower audio bitrate

For professional use with longer videos and better quality, upgrade to paid hosting.

## License

MIT
