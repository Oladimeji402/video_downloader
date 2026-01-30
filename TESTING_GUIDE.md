# Share Flow Testing Guide

## Test Environment Setup

### Required
- Modern browser with Web Share API support
- Mobile device (iOS or Android) for full testing
- Network access to backend server
- Test video (TikTok/Instagram URL or local file)

### Optional (Nice to Have)
- Network throttling tools (Chrome DevTools)
- Multiple devices for platform testing
- Screen recording for UX review

## Test Scenarios

### 1. Basic Share (No Frame)

**Setup:**
- Fetch a video
- Select "No Frame" (default)

**Steps:**
1. Click "Share" button
2. Observe modal appears with "Opening share options..."
3. Modal closes within 2-3 seconds
4. Share sheet appears

**Expected:**
- ✓ Single click experience
- ✓ No download started
- ✓ Share sheet opens immediately
- ✓ Can select WhatsApp, Messages, etc.
- ✓ Video is shared successfully

**Desktop (Chrome/Edge):**
- Share sheet may not appear
- Copy link functionality should work instead

---

### 2. Share with Frame Rendering

**Setup:**
- Fetch a video
- Select a frame (not "No Frame")
- First time sharing with this frame (cache empty)

**Steps:**
1. Click "Share" button
2. Observe:
   - Modal shows "Rendering with frame..."
   - Progress bar appears and updates
   - Modal stays visible while render completes
3. After render complete (~30-60 seconds):
   - Modal updates to show completion
   - Share sheet opens OR
   - Modal closes (if render happens during modal display)

**Expected:**
- ✓ Clear visual feedback that rendering is happening
- ✓ Progress bar shows percentage
- ✓ Share happens IMMEDIATELY (blob fetch only, not render)
- ✓ User doesn't wait for render to complete
- ✓ Next share with same frame uses cached version (instant)

**Monitor Console:**
```
Fetching video for sharing: http://...
Video blob fetched: 5242880 bytes
Starting background render...
Rendering with frame completed: framing-job-123
```

---

### 3. Cached Render (Second Share)

**Setup:**
- Video with frame already rendered (from test #2)

**Steps:**
1. Click "Share" button again
2. Observe:
   - Modal shows "Opening share options..." (not "Rendering...")
   - No progress bar (no render needed)
   - Modal closes in 1-2 seconds
   - Share sheet opens immediately

**Expected:**
- ✓ Much faster than first share (no render)
- ✓ Uses cached rendered video
- ✓ Same high quality output

---

### 4. Frame Selection Changed

**Setup:**
- Video with frame A rendered and cached
- Now select frame B

**Steps:**
1. Select frame B (different from A)
2. Click "Share"
3. Observe:
   - Modal shows "Rendering with frame..." again
   - Progress bar appears
   - Previous cache (frame A) is invalidated

**Expected:**
- ✓ Cache is cleared when frame changes
- ✓ New render starts for frame B
- ✓ Correct frame is eventually shared

---

### 5. WhatsApp Button

**Setup:**
- Video fetched, frame selected

**Steps:**
1. Click "WhatsApp" button
2. Observe:
   - Modal appears ("Rendering with frame..." if needed)
   - On mobile: Share sheet opens (select WhatsApp)
   - On desktop: WhatsApp Web URL opens in new tab

**Expected:**
- ✓ Works on both mobile and desktop
- ✓ Video shared via WhatsApp
- ✓ Seamless experience

---

### 6. Copy Link Button

**Setup:**
- Video fetched, frame selected but not rendered

**Steps:**
1. Click "Copy Link" button
2. Observe:
   - Modal shows "Rendering with frame..." + progress
   - Wait for render completion
   - Modal closes
   - Toast shows "Link copied to clipboard!"

**Steps (if already rendered):**
1. Click "Copy Link" button
2. Observe:
   - No modal (already rendered)
   - Immediate toast "Link copied!"

**Expected:**
- ✓ Handles both rendered and non-rendered states
- ✓ Shows progress when rendering
- ✓ Instant action when cached
- ✓ Clipboard contains correct link

---

### 7. Error Scenarios

#### 7a. Network Error (Blob Fetch Fails)

**Setup:**
- Simulate network error (DevTools Network tab → offline)
- Click Share

**Expected:**
- ✓ Modal appears
- ✓ Error thrown during fetch
- ✓ Modal closes
- ✓ Error toast: "Failed to fetch video"
- ✓ No share sheet appears

#### 7b. Render Fails (Backend Error)

**Setup:**
- Start sharing (with frame selected)
- Backend returns error during render

**Expected:**
- ✓ Share sheet opens immediately (blob fetch succeeds)
- ✓ Background render fails
- ✓ Modal closes
- ✓ Toast: "Failed to render video. Sharing original instead..."
- ✓ Original video shared (not frame version)

#### 7c. User Cancels Share

**Setup:**
- Share sheet opens
- Click "Cancel" instead of selecting app

**Expected:**
- ✓ No error toast shown
- ✓ Clean dismissal
- ✓ Can click Share again

#### 7d. Share API Not Supported

**Setup:**
- Old browser without navigator.share

**Expected:**
- ✓ Error toast: "Share API not supported"
- ✓ Fallback to copy link (if implemented)
- ✓ User can manually share

---

## Performance Testing

### Modal Response Time

**Measure**: Time from click to modal appearance

```javascript
// In browser console:
performance.mark('share-start');
// Click Share button manually
// Check: Document should show modal immediately

performance.mark('share-modal-visible');
performance.measure('share-response', 'share-start', 'share-modal-visible');
performance.getEntriesByName('share-response')[0].duration // Should be <100ms
```

**Expected:**
- Modal visible: <100ms
- Share sheet open: <2000ms (for blob fetch)
- Total share time: <3000ms (without render)

---

### Blob Download Speed

**Measure**: Time to fetch video blob

```javascript
// In shareVideo() function, add:
const fetchStart = performance.now();
const blob = await fetch(videoUrl).then(r => r.blob());
const fetchTime = performance.now() - fetchStart;
console.log(`Blob fetch time: ${fetchTime}ms`);
```

**Expected:**
- Typical video: 1000-2000ms
- Small video: 500-1000ms
- Large video: 3000-5000ms

### Render Time (Background)

**Measure**: Time for FFmpeg render job

```javascript
// In console, check render status:
// Share with frame, then check network tab
// Look for render/{jobId} polling
// Time from first request to "completed" status

// Typical: 20-60 seconds (depends on video length)
```

**Expected:**
- Render job: 20-60 seconds (depends on video)
- Polling overhead: <100ms per request
- Total background time: <70 seconds

---

## Device-Specific Testing

### iOS Safari

**Tests:**
1. [✓] Web Share API works
2. [✓] Can share to Messages, Mail, WhatsApp, etc.
3. [✓] Modal displays correctly
4. [✓] Video appears in share sheet
5. [✓] No unexpected downloads

**Common Issues:**
- Share sheet might show "Copy" instead of app names
- HTTPS required for production
- Blob must be actual File object

### Android Chrome

**Tests:**
1. [✓] Web Share API works
2. [✓] Share menu includes installed apps
3. [✓] Modal animations smooth
4. [✓] Progress bar visible during render
5. [✓] Keyboard doesn't interfere

**Common Issues:**
- Large files may cause timeout
- Some OEM browsers don't support Web Share API
- Need to test on multiple Android versions

### Desktop Chrome/Edge

**Tests:**
1. [✓] No share sheet (expected)
2. [✓] Falls back to copy link or error message
3. [✓] Download button still works
4. [✓] WhatsApp Web link opens

### Desktop Safari

**Tests:**
1. [✓] Copy link functionality works
2. [✓] Download button available as fallback
3. [✓] Modal displays correctly

---

## User Acceptance Testing (UAT)

### Checklist

**Functionality:**
- [ ] Share button works on mobile devices
- [ ] Frame is applied in shared video
- [ ] Video plays in receiving apps (WhatsApp, etc.)
- [ ] Quality matches Download option
- [ ] No unwanted file downloads
- [ ] Loading modal is informative

**Performance:**
- [ ] Share sheet opens quickly (<2s)
- [ ] No UI freezing or delays
- [ ] Modal animations smooth
- [ ] Progress bar updates regularly

**Error Handling:**
- [ ] Network errors show helpful message
- [ ] User can retry after error
- [ ] Graceful fallbacks when needed

**UX/Design:**
- [ ] Modal looks professional
- [ ] Text is clear and instructive
- [ ] Spinner is obvious and animated
- [ ] Colors match app theme
- [ ] Modal closes smoothly

**Accessibility:**
- [ ] Modal visible to screen readers
- [ ] Loading state communicated verbally
- [ ] Touch targets adequate (48px minimum)
- [ ] High contrast for readability

---

## Regression Testing

After each change, verify:

1. **Previous Share Functionality**
   - [ ] Share still works
   - [ ] Download still works
   - [ ] WhatsApp share still works
   - [ ] Copy link still works

2. **Other Features**
   - [ ] Frame selection still works
   - [ ] Video preview still works
   - [ ] Frame preview overlay still works
   - [ ] Tab switching still works

3. **State Management**
   - [ ] Changing frames invalidates cache
   - [ ] Fetching new video resets state
   - [ ] Clearing URL resets state

---

## Monitoring & Analytics

### Metrics to Track

In production, monitor:

```javascript
// Share button clicks
analytics.track('share_clicked', {
  has_frame: state.selectedFrame !== "none",
  cached: state.lastRenderedJobId !== null,
});

// Share completion
analytics.track('share_completed', {
  duration_ms: endTime - startTime,
  method: 'native', // or 'whatsapp', 'clipboard'
});

// Errors
analytics.track('share_error', {
  error_type: 'network', // 'render', 'support'
  error_message: err.message,
});
```

### Debug Logs

Enable debug logs in development:

```javascript
// Set global flag
window.DEBUG_SHARE = true;

// Logs will appear for:
// - Blob fetch progress
// - Render job status
// - Modal lifecycle
// - Share sheet interaction
```

---

## Known Limitations & Workarounds

### 1. Large Files
- Files >100MB may timeout or fail
- **Workaround**: Compress video server-side
- **Status**: None currently

### 2. Desktop Browsers
- Desktop Chrome/Edge don't support file sharing
- **Fallback**: Copy link to clipboard
- **Status**: Implemented

### 3. Older Android
- Some Android 4.x devices don't support Web Share API
- **Fallback**: Download button still works
- **Status**: Handled gracefully

### 4. HTTP vs HTTPS
- Web Share API only works on HTTPS (except localhost)
- **Workaround**: Use HTTPS in production
- **Status**: Environment-dependent

---

## Quick Debug Checklist

**If share doesn't work:**

1. Check browser console for errors
2. Verify `navigator.share` is available
   ```javascript
   console.log(typeof navigator.share);
   ```
3. Check blob size is > 0
   ```javascript
   console.log(`Blob size: ${blob.size}`);
   ```
4. Verify network tab shows blob download
5. Check DevTools network throttling
6. Try on different device/browser

**If modal doesn't appear:**

1. Check if modal HTML is in DOM
   ```javascript
   console.log(document.getElementById('shareModalOverlay'));
   ```
2. Check CSS is injected
   ```javascript
   console.log(document.getElementById('shareModalStyles'));
   ```
3. Check z-index isn't hidden behind other elements
4. Check for JavaScript errors in console

**If progress bar doesn't update:**

1. Check render job is actually running
   - Network tab → filter "render"
   - Should see POST and repeated GETs
2. Check status response has progress field
   ```javascript
   fetch(`/api/video/render/${jobId}`).then(r => r.json())
   ```
3. Check progress bar element exists
   ```javascript
   document.getElementById('shareModalProgressBar');
   ```
