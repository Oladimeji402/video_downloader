# Share Flow Implementation Guide

## Quick Overview

The share functionality has been completely redesigned to provide a **true one-click, gesture-preserving experience** with visual loading feedback.

## What Changed

### Main Share Button Flow

```javascript
User clicks "Share"
  ↓
shareVideo() invoked
  ├─ Show loading modal immediately
  ├─ Fetch video blob (preserves gesture context)
  ├─ Start background render if needed (non-blocking)
  └─ Call shareBlob(blob) → navigator.share()
    ↓
Share sheet opens within gesture context
  ↓
User selects app (WhatsApp, Messages, etc.)
  ↓
Video shared directly from memory ✓
```

## Key Functions

### 1. `shareVideo()` - Main entry point
- Called when "Share" button is clicked
- Shows loading modal immediately
- Fetches video as Blob (fast)
- Starts background render if needed
- Calls `shareBlob()` to invoke native share

```javascript
async function shareVideo() {
  showShareLoadingModal(needsRendering);
  const blob = await fetch(videoUrl).then(r => r.blob());
  if (needsRendering) {
    renderVideoInBackground().then(...); // Fire and forget
  }
  await shareBlob(blob); // Share immediately
}
```

### 2. `shareBlob(blob)` - Native share implementation
- Validates Web Share API support
- Creates File from Blob
- Calls `navigator.share()`
- Handles user cancellation gracefully

```javascript
async function shareBlob(blob) {
  // Create File from Blob
  const file = new File([blob], `framed-video-${Date.now()}.mp4`, {
    type: "video/mp4",
  });
  
  // Validate and share
  if (navigator.canShare({ files: [file], ... })) {
    await navigator.share(shareData);
  }
}
```

### 3. `showShareLoadingModal(showRenderProgress)`
- Creates and displays loading modal
- Shows different messages based on context
- Includes progress bar only when rendering
- Injected CSS (no separate stylesheet)

```javascript
showShareLoadingModal(true); // Shows render progress
showShareLoadingModal(false); // Simple "Preparing..." message
```

### 4. `closeShareLoadingModal()`
- Removes modal with smooth animation
- Called when sharing completes or errors occur

### 5. `renderVideoInBackground()`
- Starts async render without blocking share
- Returns Promise<jobId>
- Polling handled internally

```javascript
renderVideoInBackground()
  .then(jobId => {
    state.lastRenderedJobId = jobId;
    state.lastRenderedUrl = `${API_BASE}/video/download/${jobId}`;
  })
  .catch(err => console.error(err));
```

### 6. `shareToWhatsApp()` - WhatsApp-specific sharing
- Tries native share first (mobile)
- Falls back to WhatsApp Web (desktop)
- Shows loading modal with background render

### 7. `copyVideoLink()` - Link copying with render support
- Shows modal if rendering needed
- Waits for render completion
- Copies shareable URL to clipboard

## Browser Support

| Browser | Support | Method |
|---------|---------|--------|
| **iOS Safari** | ✓ Full | navigator.share() |
| **Android Chrome** | ✓ Full | navigator.share() |
| **Android Firefox** | ✓ Full | navigator.share() |
| **Desktop Safari** | ✓ Limited | Clipboard only |
| **Desktop Chrome/Edge** | ✓ Limited | Clipboard only |
| **Older browsers** | ✗ | Copy link fallback |

## Visual Loading Experience

### No Rendering Needed
```
1. Click Share
2. Modal: "Preparing Video..." (1-2 seconds)
3. Share sheet opens
4. Done
```

### With Frame Rendering
```
1. Click Share
2. Modal: "Rendering with frame..." + progress bar
3. Video fetches + render starts in background (~30s)
4. Share sheet opens immediately (after blob fetch ~2s)
5. User can share now
6. Render completes in background
7. Next share uses rendered video
```

## Gesture Context Preservation

### Critical: Why This Matters

`navigator.share()` requires active user gesture context. This means:

✓ **Works**: Called directly in click handler
```javascript
button.addEventListener('click', async () => {
  await navigator.share(...); // Within gesture scope
});
```

✓ **Works**: Called after quick async operation
```javascript
button.addEventListener('click', async () => {
  const data = await fetch(...).then(r => r.json()); // <1-2 seconds
  await navigator.share(data); // Still within gesture scope
});
```

❌ **Doesn't Work**: Called after long async operation
```javascript
button.addEventListener('click', async () => {
  await longRenderingProcess(); // 30+ seconds
  await navigator.share(...); // Gesture expired!
});
```

### Our Solution

We fetch the blob **immediately** (1-2 seconds), then share before gesture expires:

```javascript
// Fetch blob quickly (preserves gesture) ✓
const blob = await fetch(videoUrl).then(r => r.blob()); // 1-2s

// Start render in background (non-blocking) ✓
renderVideoInBackground().then(...); // Fire and forget

// Share immediately (within gesture context) ✓
await shareBlob(blob); // Opens share sheet NOW

// Render completes later (~30s) ✓
// Next share uses rendered video
```

## Error Handling

### Share API Not Supported
```javascript
if (!navigator.share || !navigator.canShare) {
  throw new Error("Share API not supported");
}
```

### User Cancels Share
```javascript
try {
  await navigator.share(...);
} catch (err) {
  if (err.name === "AbortError") {
    // User canceled - don't show error
    return;
  }
  throw err; // Other errors
}
```

### Render Fails
```javascript
renderVideoInBackground()
  .catch(err => {
    closeShareLoadingModal();
    showToast("Failed to render. Sharing original...", "warning");
  });
```

## State Management

### Updated State Variables
```javascript
state = {
  videoId: null,                    // Current video ID
  selectedFrame: "none",            // Selected frame ID
  frames: [],                       // Available frames
  isProcessing: false,              // Processing flag
  lastRenderedJobId: null,          // ← Caches rendered video
  lastRenderedUrl: null,            // ← Caches rendered URL
};
```

The `lastRenderedJobId` and `lastRenderedUrl` cache the rendered video so:
1. Second share uses cached version (no re-render)
2. Download button also uses cached version
3. Cache is invalidated when frame selection changes

## Testing Checklist

### Desktop (Chrome DevTools Device Emulation)
- [ ] Click Share → Copy link shown
- [ ] Modal disappears (no share sheet on desktop)
- [ ] Toast shows "Copy link" option

### Mobile (Real Device)
- [ ] Click Share → Share sheet opens in <2 seconds
- [ ] Select app → Video shared successfully
- [ ] With frame: Modal shows render progress in background

### Edge Cases
- [ ] Share without video → Error toast
- [ ] Network error → Error handled gracefully
- [ ] Render fails → Original shared instead
- [ ] User cancels share → No error toast
- [ ] Switch frames → Cache invalidated

## Performance Considerations

1. **Blob Download**: ~1-2 seconds for typical video
2. **Share Sheet Opening**: <100ms after blob ready
3. **Background Render**: ~30 seconds (non-blocking)
4. **Modal Display**: 60fps smooth animations

## Debugging

### Console Logs (Development)
The implementation includes debug logging:

```javascript
console.log("Fetching video for sharing:", videoUrl);
console.log(`Video blob fetched: ${blob.size} bytes`);
console.log("Starting background render...");
console.log("Render completed in background, jobId:", renderedJobId);
```

### Network Tab
Check that:
1. Initial video blob fetch (1-2s)
2. Render request POST (starts immediately)
3. Render status polls (every 2s with backoff)

### Browser DevTools
- Network throttling to simulate slow connections
- Device emulation to test mobile share
- Console for error messages

## Future Improvements

- [ ] Show progress percentage during blob fetch (if file is large)
- [ ] Compress video before sharing for faster transfer
- [ ] Cache rendered blobs in IndexedDB for offline sharing
- [ ] Add share analytics (which apps are most used)
- [ ] Custom share message templates
