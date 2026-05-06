# Frontend - VideoFramer UI

Vanilla JavaScript frontend for video framing application.

## Quick Start

Open `index.html` in a browser or serve via the backend at `http://localhost:4000`

## Features

- **URL Input** - Paste video URLs from TikTok, Instagram, YouTube, Twitter, Facebook
- **File Upload** - Upload video files directly (max 500MB)
- **Video Preview** - Real-time preview with frame overlay
- **Frame Selection** - Choose from available frame templates
- **Progress Tracking** - Visual progress bars for download and render
- **Background Pre-rendering** - Starts rendering when frame is selected
- **Share Options** - Native share, WhatsApp, copy link
- **Mobile Optimized** - Responsive design with touch support

## Architecture

### Core Files

- **index.html** - Main HTML structure
- **style.css** - Responsive styling with CSS variables
- **script.js** - Application logic and API integration
- **env.js** - Environment configuration
- **manifest.json** - PWA manifest

### Key Components

1. **URL Input Section** - Paste/clear video URLs
2. **Preview Section** - Video player with frame overlay
3. **Frame Selector** - Grid of available frames
4. **Download Section** - Download and share buttons
5. **Toast Notifications** - User feedback
6. **Server Banner** - Cold start indicator

## Configuration

Edit `env.js` to set API endpoint:

```javascript
window.ENV = {
  API_URL: "http://localhost:4000/api"  // Backend API URL
};
```

## State Management

The app uses a global `state` object:

```javascript
{
  videoId: null,              // Current video ID
  selectedFrame: "none",      // Selected frame ID
  frames: [],                 // Available frames
  isProcessing: false,        // Processing flag
  lastRenderedJobId: null,    // Last render job
  lastRenderedUrl: null,      // Last rendered video URL
  renderedVideoBlob: null,    // Cached rendered video
  serverReady: false,         // Server status
  bgRenderPromise: null       // Background render promise
}
```

## API Integration

### Endpoints Used

```javascript
// Video operations
POST   /api/video/resolve      // Start download
POST   /api/video/upload       // Upload file
GET    /api/video/status/:id   // Poll download status
GET    /api/video/preview/:id  // Stream video

// Frame operations
GET    /api/frames             // List frames
GET    /api/frames/:filename   // Get frame image

// Render operations
POST   /api/video/render       // Start render
GET    /api/video/render/:id   // Poll render status
GET    /api/video/download/:id // Download result

// Health
GET    /api/health             // Server health
```

### Polling Strategy

- **Interval**: 800ms
- **Max polls**: 300 (4 minutes)
- **Exponential backoff** on 429 errors
- **Auto-retry** on network errors

## Performance Optimizations

1. **Frame Preloading** - All frames loaded on startup
2. **Background Pre-rendering** - Starts when frame selected
3. **Blob Caching** - Rendered videos cached in memory
4. **Lazy Loading** - Frame images loaded on demand
5. **Server Keep-alive** - Pings every 14 minutes to prevent cold starts

## User Flow

```
1. User pastes URL or uploads file
   ↓
2. Video downloads (progress shown)
   ↓
3. Preview appears with frame overlay
   ↓
4. User selects frame (pre-render starts)
   ↓
5. User clicks Download/Share
   ↓
6. Rendered video ready (instant if pre-rendered)
```

## Supported Platforms

- TikTok
- Instagram
- YouTube
- Twitter/X
- Facebook

## Browser Compatibility

- **Modern browsers** - Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile** - iOS Safari, Chrome Mobile
- **Features** - ES6+, Fetch API, Async/Await, Web Share API

## Customization

### Styling

Edit CSS variables in `style.css`:

```css
:root {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
  /* ... */
}
```

### Polling Intervals

Edit constants in `script.js`:

```javascript
const POLL_INTERVAL = 800;  // Status polling interval (ms)
```

## Troubleshooting

### Video Not Loading
- Check browser console for errors
- Verify API_URL in env.js
- Check network tab for failed requests

### Frame Not Showing
- Ensure frame has transparent center
- Check frame is loaded in /api/frames
- Verify frame ID matches

### Share Not Working
- Web Share API requires HTTPS (except localhost)
- Check browser compatibility
- Fallback to copy link

### Slow Performance
- Check network speed
- Verify server is not cold-starting
- Try smaller video files

## Development

### Local Development

1. Start backend: `cd backend && npm start`
2. Open `frontend/index.html` in browser
3. Or visit `http://localhost:4000`

### Testing

- Test with various video URLs
- Test file upload
- Test on mobile devices
- Test share functionality
- Test offline behavior

## Deployment

The frontend is served by the backend Express server. No separate deployment needed.

For CDN deployment, update `env.js` with production API URL.
