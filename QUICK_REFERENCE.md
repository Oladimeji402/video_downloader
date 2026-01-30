# Share Flow - Quick Reference

## One-Page Overview

### The Fix
Changed from **2-click download-first flow** to **1-click direct share** with visual loading feedback.

### Core Insight
- **Problem**: Long async operations (render) → Lost user gesture context → Fallback to download
- **Solution**: Quick blob fetch (1-2s) → Preserve gesture → Direct sharing → Async render in background

### Main Flow
```javascript
User clicks Share
  ↓
shareVideo() // NEW
  ├─ showShareLoadingModal() // NEW - show feedback immediately
  ├─ fetch blob (1-2s) // PRESERVED - preserves gesture
  ├─ renderVideoInBackground() // NEW - non-blocking
  └─ shareBlob(blob) // NEW - native share with gesture intact
    ↓
Share sheet opens (<2s)
  ↓
User shares in 1 click ✓
```

---

## New Functions (Quick Reference)

### `shareVideo()` - Main entry point
```javascript
// Called by: Share button click
// Purpose: Single-click sharing with visual feedback
// Steps:
//   1. Show loading modal
//   2. Fetch video blob (preserves gesture)
//   3. Start background render if needed
//   4. Call shareBlob() → navigator.share()
// Returns: Promise (resolves when shared or error)
```

### `shareBlob(blob)` - Native sharing
```javascript
// Purpose: Invoke navigator.share() with Blob
// Input: Blob object (video data)
// Returns: Promise
// Handles: User gesture, API support, user cancellation
```

### `renderVideoInBackground()` - Non-blocking render
```javascript
// Purpose: Start render without blocking share flow
// Returns: Promise<jobId>
// Side effects: Updates state.lastRenderedJobId when done
```

### `showShareLoadingModal(needsRender)` - Loading UI
```javascript
// Input: Boolean - true if rendering, false if just fetching
// Shows:
//   - If needsRender=true: "Rendering with frame..." + progress bar
//   - If needsRender=false: "Opening share options..."
// Note: CSS injected dynamically (no stylesheet needed)
```

### `closeShareLoadingModal()` - Cleanup
```javascript
// Purpose: Remove modal with smooth animation
// Called by: When share completes or error occurs
```

---

## Updated Functions

### `shareToWhatsApp()`
```javascript
// Now supports:
//   - Native share (mobile)
//   - WhatsApp Web fallback (desktop)
//   - Background rendering
// Shows loading modal during render
```

### `copyVideoLink()`
```javascript
// Now handles:
//   - Rendering if needed (with modal)
//   - Immediate copy if already rendered
// Returns: Promise
```

---

## Modal HTML/CSS

### Injected Into DOM
```html
<div class="share-modal-overlay" id="shareModalOverlay">
  <div class="share-modal">
    <div class="share-modal-content">
      <div class="share-spinner-large"></div>
      <h3 class="share-modal-title">Preparing Video</h3>
      <p class="share-modal-text" id="shareModalText">
        Rendering with frame...
      </p>
      <div class="share-modal-progress">
        <div class="share-modal-progress-bar" id="shareModalProgressBar"></div>
      </div>
    </div>
  </div>
</div>
```

### CSS Features
- Full-screen overlay with blur backdrop
- Centered modal card
- Smooth slide-up animation
- Large spinner (48px)
- Progress bar (optional)
- Responsive: 90% width on mobile, 320px max on desktop

---

## Browser Compatibility

```
✓ iOS Safari          → navigator.share()
✓ Android Chrome      → navigator.share()
✓ Android Firefox     → navigator.share()
✓ Desktop Chrome/Edge → Fallback (error or copy link)
✓ Desktop Safari      → Fallback (error or copy link)
✓ Old browsers        → Graceful error message
```

---

## State Management

### Cache Variables (In `state` object)
```javascript
lastRenderedJobId: null  // Cache key for rendered video
lastRenderedUrl: null    // Cache URL for rendered video
```

### Cache Invalidation
```javascript
// Cleared when:
selectFrame(newFrameId) → state.lastRenderedJobId = null

// Updated when:
renderVideoInBackground() → state.lastRenderedJobId = jobId
```

### Cache Usage
```javascript
// Check if render is cached:
if (state.lastRenderedJobId && state.selectedFrame !== "none") {
  // Use cached: state.lastRenderedUrl
} else {
  // Use original: state.videoId
}
```

---

## Loading States

### Visual Feedback Timeline

**No Rendering:**
```
0ms:  Modal shows "Opening share options..."
1s:   Video blob fetches
2s:   Modal closes
2s:   Share sheet opens
3s:   User selects app
```

**With Rendering:**
```
0ms:  Modal shows "Rendering with frame..." + progress bar
1s:   Blob fetches + render starts (background)
2s:   Share sheet opens (blob ready)
3s:   User shares
30s:  Render completes (background)
Next share: Uses rendered version (instant)
```

---

## Error Messages

| Scenario | Message | Action |
|----------|---------|--------|
| No video | "Please fetch a video first" | None |
| Blob fetch fails | "Failed to fetch video: {status}" | Retry |
| Render fails | "Failed to render video. Sharing original instead..." | Shares original |
| Share unsupported | "Share API not supported on this device" | Use Download |
| User cancels | (no message) | Clean dismissal |

---

## Network Calls

### Blob Fetch
```
GET /api/video/preview/{videoId}
→ Returns: MP4 video blob
Time: 1-2s (typical)
```

### Render Start
```
POST /api/video/render
Body: { videoId, frameId }
→ Returns: { success, jobId }
Time: <100ms
```

### Render Status (Polling)
```
GET /api/video/render/{jobId}
→ Returns: { status, progress }
Interval: 2s (with backoff)
```

### Rendered Video Fetch
```
GET /api/video/download/{jobId}
→ Returns: MP4 video blob
Time: 1-2s (after render)
```

---

## Testing Quick Checks

### Desktop Browser
```
1. Click Share
2. Copy link dialog appears (expected)
3. Click "Copy Link"
4. Paste in browser → Video URL
```

### Mobile (Real Device)
```
1. Click Share
2. Native share sheet appears <2s
3. Select WhatsApp
4. Video appears in chat
5. Frame applied correctly ✓
```

### With Frame (First Time)
```
1. Select frame
2. Click Share
3. Modal shows "Rendering..." + progress
4. Share sheet opens (<2s)
5. Share while render happens
6. Done! ✓
```

### With Frame (Cached)
```
1. Same frame as before
2. Click Share
3. Modal shows "Preparing..." (no render)
4. Share sheet opens (<1s)
5. Much faster! ✓
```

---

## Debug Checklist

**Share not working?**
- [ ] Check browser console for errors
- [ ] Verify `navigator.share` exists
- [ ] Check blob size > 0
- [ ] Check network tab for blob download
- [ ] Test on mobile device

**Modal not appearing?**
- [ ] Check modal HTML in DOM
- [ ] Check CSS injection in head
- [ ] Check z-index issues
- [ ] Check JavaScript errors

**Render not progressing?**
- [ ] Check network tab for render POST
- [ ] Check for render status polls (GET)
- [ ] Check progress bar updates
- [ ] Check console for errors

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Share sheet doesn't open | Desktop browser | Expected - use copy link |
| Download starts | Old code path | Clear browser cache |
| Modal stuck | Fetch failed | Check network/console |
| Render never completes | Backend issue | Check server logs |
| Gesture context error | Long wait before share | No longer happens (non-blocking) |

---

## Key Files

```
frontend/
  ├── index.html          (no changes)
  ├── style.css           (no changes)
  └── script.js           (redesigned share functions)

backend/
  ├── index.js            (no changes)
  ├── routes/
  │   └── video.routes.js (no changes)
  └── services/           (no changes)
```

---

## Related Documentation

- **SHARE_FLOW_REDESIGN.md** - Full technical details
- **BEFORE_AFTER_COMPARISON.md** - Visual timeline comparison
- **SHARE_IMPLEMENTATION_GUIDE.md** - Developer guide
- **TESTING_GUIDE.md** - Comprehensive testing procedures
- **IMPLEMENTATION_SUMMARY.md** - Executive summary
