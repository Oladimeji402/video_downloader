# Frontend - Video Framer

Clean, mobile-first frontend for video framing with social media integration.

## Features

- ✅ Paste video URL from TikTok, Instagram, YouTube, Twitter, Facebook
- ✅ Real-time video preview
- ✅ Select frame overlay from gallery
- ✅ Download with frame applied
- ✅ iOS native share integration
- ✅ File size display
- ✅ Progress tracking
- ✅ PWA support

## Files

- `index.html` - Main application
- `style.css` - Responsive styling
- `script.js` - Core functionality
- `env.js` - API configuration
- `manifest.json` - PWA manifest
- `icon-*.png` - PWA icons

## Configuration

Edit `env.js` to point to your backend:

```javascript
window.ENV = {
  API_URL: "https://your-backend.onrender.com/api"
};
```

## Features

### Video Processing
- Automatic video download from URL
- Server-side frame overlay rendering
- Progress indication during processing

### iPhone Optimization
- iOS detection
- Native share API integration
- File size warnings
- Better download UX

### Frame Selection
- Visual frame gallery
- Instant preview overlay
- Pre-rendering for faster downloads
- Frame image caching

## Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Netlify
Drag and drop `frontend` folder to Netlify dashboard.

### GitHub Pages
1. Push to GitHub
2. Settings → Pages
3. Select branch and `/frontend` folder

### Any Static Host
Upload all files in `frontend` folder to your static hosting.

## Browser Support

- Modern browsers (Chrome, Safari, Firefox, Edge)
- iOS Safari 14+ (native share support)
- Android Chrome 90+
- Progressive Web App (installable)

## Performance

Optimized for mobile:
- Lazy loading frame thumbnails
- Chunked video streaming
- Progress tracking for long operations
- File size warnings for cellular users
