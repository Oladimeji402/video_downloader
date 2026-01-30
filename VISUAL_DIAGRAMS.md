# Share Flow - Visual Diagrams & Flowcharts

## 1. Complete Share Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     USER CLICKS SHARE                          │
│              (Active gesture context ✓)                        │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ shareVideo() invoked        │
        │ Purpose: Main entry point   │
        │ Context: User gesture       │
        └────────────────┬────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ showShareLoadingModal()                 │
        │ Visual Feedback: Immediate!            │
        │ ┌─────────────────────────────────────┐│
        ││  🔄 Preparing Video                   ││
        ││  "Opening share options..."           ││
        │└─────────────────────────────────────┘│
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ Determine video URL                    │
        │                                        │
        │ If frame rendered:                     │
        │   Use /api/video/download/{jobId}     │
        │ Else:                                  │
        │   Use /api/video/preview/{videoId}   │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ fetch(videoUrl).then(r => r.blob())   │
        │ Download video to memory               │
        │ Duration: ~1-2 seconds                 │
        │ Gesture context: PRESERVED ✓          │
        └────────────────┬─────────────────────┘
                         │
          ┌──────────────┴───────────────┐
          │                              │
          ▼                              ▼
   ┌──────────────┐           ┌──────────────────┐
   │ No Rendering │           │ With Rendering   │
   │ Needed       │           │ Needed           │
   └──────┬───────┘           └────────┬─────────┘
          │                           │
          │                           ▼
          │         ┌─────────────────────────────┐
          │         │ renderVideoInBackground()   │
          │         │ Non-blocking!               │
          │         │ Returns: Promise<jobId>    │
          │         │ Polling: Status checks     │
          │         │ Duration: ~30-60 seconds   │
          │         │ (Happens in background)    │
          │         └────────────┬────────────────┘
          │                      │
          │                      ▼
          │         ┌─────────────────────────────┐
          │         │ Render Job                  │
          │         │ FFmpeg processing           │
          │         │ Progress: 0% → 100%        │
          │         │ Status: completed           │
          │         └────────────┬────────────────┘
          │                      │
          │                      ▼
          │         ┌─────────────────────────────┐
          │         │ Update state                │
          │         │ .lastRenderedJobId = jobId │
          │         │ .lastRenderedUrl = URL    │
          │         └─────────────────────────────┘
          │
          └──────────────┬───────────────┐
                         │               │
                         ▼               ▼
        ┌────────────────────────────────────────┐
        │ closeShareLoadingModal() (if fetch only)
        │ OR                                     │
        │ Modal closes (when blob ready)        │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ shareBlob(blob)                        │
        │ Purpose: Invoke navigator.share()     │
        │                                        │
        │ Steps:                                 │
        │ 1. Create File from Blob              │
        │ 2. Check navigator.share support     │
        │ 3. Check navigator.canShare()        │
        │ 4. Call navigator.share(file)        │
        │                                        │
        │ Gesture Context: ACTIVE ✓            │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ SHARE SHEET OPENS                      │
        │ ┌────────────────────────────────────┐ │
        │ │ Share                          [✕] │ │
        │ │                                    │ │
        │ │ ○ WhatsApp                        │ │
        │ │ ○ Messages                        │ │
        │ │ ○ Mail                            │ │
        │ │ ○ AirDrop (iOS)                   │ │
        │ │ ○ More...                         │ │
        │ │                                    │ │
        │ │   [Cancel]  [Share]               │ │
        │ └────────────────────────────────────┘ │
        │                                        │
        │ Video ready in memory ✓              │
        │ Gesture context preserved ✓         │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ USER SELECTS APP                       │
        │ e.g., WhatsApp                         │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ VIDEO SHARED ✓                         │
        │                                        │
        │ App opens with video attached          │
        │ User can add caption and send          │
        │                                        │
        │ SUCCESS! (in ~2-3 seconds)            │
        └────────────────────────────────────────┘

        ┌────────────────────────────────────────┐
        │ [Optional] Background                  │
        │ Render completes                       │
        │ Cache updated for next share           │
        └────────────────────────────────────────┘
```

---

## 2. Decision Tree - What Happens

```
                    Click Share
                        │
                        ▼
              Is there a video?
              ├─ NO  → Error: "Fetch video first"
              └─ YES → Continue
                        │
                        ▼
              Show loading modal immediately
                        │
                        ▼
              Fetch video blob (1-2s)
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
      Frame selected?            Original video
      ├─ YES                         │
      │   ▼                          ▼
      │ Already rendered?         Share blob
      │ ├─ YES → Use cached       ← Gesture
      │ │   ▼                       still active
      │ │ Share blob              │
      │ │ (Instant next share)    ▼
      │ │                     navigator.share()
      │ └─ NO → Start render    opens share
      │   │    in background     sheet < 2s
      │   ▼
      │ Share blob
      │ (render continues)
      │   │
      │   ▼
      │ Render completes
      │ Cache updated
      │
      └─ Done!
```

---

## 3. State Diagram

```
                    ┌─────────────────────────────────┐
                    │ INITIAL STATE                   │
                    │ videoId: null                   │
                    │ selectedFrame: "none"           │
                    │ lastRenderedJobId: null         │
                    │ lastRenderedUrl: null           │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Fetch Video (URL/Upload)    │
                    │ State: videoId set          │
                    │ Cache: CLEARED              │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │ Video Loaded State              │
                    │ videoId: "abc123"               │
                    │ selectedFrame: "none"           │
                    │ Can preview & select frame      │
                    └──────────────┬──────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │                   │
                         ▼                   ▼
          ┌──────────────────────┐  ┌───────────────┐
          │ Select Frame         │  │ Share/Download│
          │ (any frame)          │  │ Without Frame │
          │ selectedFrame: "id"  │  │ Frame: "none" │
          │ Cache: CLEARED ✓     │  │ Cache: OK     │
          └──────┬───────────────┘  └─────┬─────────┘
                 │                        │
                 ▼                        ▼
          ┌──────────────────────────────────────┐
          │ Click Share/Download                 │
          └──────────────┬───────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
    Rendering needed?          Already rendered?
    (frame + no cache)          (cached job found)
         │ Yes                        │ Yes
         │                           │
         ▼                           ▼
    ┌─────────────┐         ┌──────────────┐
    │ Render      │         │ Use Cache    │
    │ In Progress │         │ lastRenderedUrl
    │             │         │              │
    │ Progress    │         └──────┬───────┘
    │ 0% → 100%   │                │
    │             │        ┌───────▼────────┐
    │ Modal shows │        │ Share/Download │
    │ "Rendering" │        │ Video Ready    │
    └──────┬──────┘        │ Fast!          │
           │               └────────────────┘
           ▼
    ┌─────────────────────────┐
    │ Render Complete         │
    │ lastRenderedJobId: jobId│
    │ lastRenderedUrl: URL    │
    │ CACHED for next share   │
    └─────────────────────────┘
```

---

## 4. Timeline Comparison

### BEFORE (Broken UX)
```
Timeline:                    User Action:
│
0s:  Click Share
│    ▼
│    Toast: "Rendering..."
│    [No progress indication]
│
5s:  [Waiting...]
│    [Still rendering]
│
15s: [Still waiting...]
│    [User has no idea]
│
30s: Render complete!
│    BUT: Gesture EXPIRED
│    ▼
│    Download starts (fallback)
│    [Not what user wanted]
│
31s: [User frustrated]
│    ▼
│    Must click Share AGAIN
│    ▼
│    Share sheet finally opens
│
35s: User selects app
│    ▼
│    Video shared
     (But file already downloaded)

TOTAL TIME: ~35 seconds with 2 clicks ❌
```

### AFTER (Fixed UX)
```
Timeline:                    User Experience:
│
0ms:  Click Share
│     ▼ [Gesture active]
│     Modal appears immediately
│     "Opening share options..."
│
200ms: [Gesture still active]
│      Visual feedback: Clear!
│      ▼
│
1s:   Video blob fetches
│     Render starts (background)
│     ▼
│
2s:   Share sheet opens
│     Video ready in memory
│     [Gesture preserved ✓]
│     ▼
│
3s:   User taps WhatsApp
│     ▼
│     Video shared ✓
│
5s:   Success! First share done
│     [If rendering was needed:]
│     Render continues in background

~30s: Render completes
      Cache updated
      ▼
      Next share: Instant! (<1s)

TOTAL TIME: ~3 seconds with 1 click ✓
          (or ~30 seconds total with background render,
           but user can share while it happens)
```

---

## 5. Memory vs Disk

### BEFORE (Wrong Approach)
```
┌────────────────────────────────────────┐
│ User clicks Share                      │
└────────────────┬───────────────────────┘
                 │
        ┌────────▼────────┐
        │ Network         │
        │ Server          │
        │ (video data)    │
        └────────┬────────┘
                 │
          ┌──────▼──────┐
          │   DISK      │
          │ ~/Downloads/│      ❌ File saved to disk
          │ framed.mp4  │      ❌ Takes ~30+ seconds
          │             │      ❌ User gesture lost
          └──────┬──────┘
                 │
          ┌──────▼──────────────────┐
          │ Fall back to Download   │
          │ (Can't use Share API)   │
          └────────────────────────┘

RESULT: File on disk + user must share manually
```

### AFTER (Correct Approach)
```
┌────────────────────────────────────────┐
│ User clicks Share                      │
└────────────────┬───────────────────────┘
                 │
        ┌────────▼────────┐
        │ Network         │
        │ Server          │
        │ (video data)    │
        └────────┬────────┘
                 │
          ┌──────▼──────────┐
          │   RAM (Blob)    │
          │   In Memory     │      ✓ No disk I/O
          │   Temporary     │      ✓ Fast (1-2s)
          │   (1-2s)        │      ✓ Gesture preserved
          └──────┬──────────┘
                 │
          ┌──────▼──────────────────────┐
          │ navigator.share(blob)       │
          │ (While gesture is active)   │
          │ Opens share sheet < 2s ✓   │
          └──────┬─────────────────────┘
                 │
          ┌──────▼──────────────────────┐
          │ Share to WhatsApp/Messages  │
          │ Video shared directly       │
          │ FROM MEMORY (No download)   │
          └─────────────────────────────┘

[Optional Background]
  │
  ▼
Render job continues (~30s)
Updates cache
Next share is instant!

RESULT: Direct sharing + background rendering + instant repeats
```

---

## 6. Modal Lifecycle

```
Start:
  │
  ▼
showShareLoadingModal(false)
  │
  ├─ Remove existing modal
  ├─ Create HTML (selector: #shareModalOverlay)
  ├─ Inject HTML into <body>
  ├─ Inject CSS into <head>
  │
  ▼
Modal is visible
  │
  ├─ Spinner: spinning (1s animation loop)
  ├─ Title: "Preparing Video"
  ├─ Text: "Opening share options..."
  ├─ No progress bar (not rendering)
  │
  ▼
User interacts / Blob ready
  │
  ▼
closeShareLoadingModal()
  │
  ├─ Trigger exit animation
  │  └─ reverse slideUp (0.3s)
  ├─ Wait for animation
  │  └─ setTimeout 300ms
  ├─ Remove from DOM
  │  └─ modal.remove()
  │
  ▼
Modal is gone
  │
  ▼
Share sheet appears
```

### With Rendering
```
showShareLoadingModal(true)
  │
  ▼
Modal shows:
  ├─ Spinner
  ├─ "Rendering with frame..."
  ├─ Progress bar (0%)
  │
  ▼
Background render polls
  │
  ├─ 0-10s: Progress 0-20%
  ├─ 10-20s: Progress 20-50%
  ├─ 20-30s: Progress 50-80%
  ├─ 30-35s: Progress 80-100%
  │
  ├─ Update: progressBar.style.width = "40%"
  │
  ▼
Render completes
  │
  ▼
updateShareModalWithRenderedVideo()
  │
  ├─ Update text: "Ready to share!"
  ├─ Set progress: width = "100%"
  ├─ Wait 1s
  │
  ▼
closeShareLoadingModal()
  │
  ├─ Exit animation (0.3s)
  │
  ▼
Modal closed
```

---

## 7. Error Flow

```
User clicks Share
    │
    ▼
Error occurs during:

├─ Network error (blob fetch fails)
│   │
│   ▼
│   closeShareLoadingModal()
│   ▼
│   showToast("Failed to fetch video", "error")
│   ▼
│   User can retry
│
├─ Render fails (in background)
│   │
│   ▼
│   Catch in .catch() handler
│   ▼
│   closeShareLoadingModal()
│   ▼
│   showToast("Failed to render. Sharing original...", "warning")
│   ▼
│   Video shared (original, not framed)
│   ▼
│   User gets value anyway ✓
│
├─ Share API not supported
│   │
│   ▼
│   Throw error in shareBlob()
│   ▼
│   closeShareLoadingModal()
│   ▼
│   showToast("Share API not supported on this device", "error")
│   ▼
│   User can use Download instead ✓
│
└─ User cancels share
    │
    ▼
    AbortError caught
    ▼
    (No toast - user intentionally canceled)
    ▼
    User can click Share again
```

---

## 8. Cache Invalidation

```
Cache State Machine:

┌────────────────────────┐
│ NO RENDER (Initial)    │
│ jobId: null            │
│ url: null              │
└────────────┬───────────┘
             │
             ▼
    Select Frame A
             │
             ▼
    ┌────────────────────────┐
    │ RENDERING FRAME A      │
    │ jobId: null (pending)  │
    │ url: null              │
    └────────┬───────────────┘
             │
             ▼
    Render completes
             │
             ▼
    ┌────────────────────────────────┐
    │ CACHED - FRAME A               │
    │ jobId: "job-123"               │
    │ url: "/api/video/download/123" │
    └────────┬───────────────────────┘
             │
             │ ← Next shares use cache (instant)
             │
             ▼
    Select Frame B
             │
             ▼ ❌ INVALIDATE CACHE
    ┌────────────────────────┐
    │ RENDERING FRAME B      │
    │ jobId: null (cleared)  │
    │ url: null (cleared)    │
    └────────┬───────────────┘
             │
             ▼
    Render completes
             │
             ▼
    ┌────────────────────────────────┐
    │ CACHED - FRAME B               │
    │ jobId: "job-456"               │
    │ url: "/api/video/download/456" │
    └────────────────────────────────┘
```

---

## 9. Function Call Graph

```
shareVideo()
  ├─ showShareLoadingModal(needsRendering)
  │   ├─ remove existing modal
  │   ├─ create HTML
  │   ├─ inject into DOM
  │   └─ inject CSS (if needed)
  │
  ├─ fetch(videoUrl)
  │   └─ .then(r => r.blob())
  │
  ├─ renderVideoInBackground()
  │   ├─ fetch POST /api/video/render
  │   └─ pollRenderJob(jobId)
  │       └─ [loop] fetch GET /api/video/render/{jobId}
  │           └─ return jobId on "completed"
  │
  ├─ updateShareModalWithRenderedVideo() [async]
  │   ├─ fetch(state.lastRenderedUrl)
  │   └─ .then(r => r.blob())
  │
  └─ shareBlob(blob)
      ├─ new File([blob], ...)
      ├─ navigator.canShare(shareData)
      └─ navigator.share(shareData)
          └─ Share sheet opens!

shareToWhatsApp()
  ├─ showShareLoadingModal(needsRendering)
  ├─ fetch(videoUrl)
  ├─ renderVideoInBackground() [optional]
  ├─ closeShareLoadingModal()
  ├─ [Try] navigator.share() [mobile]
  └─ [Fallback] window.open('https://wa.me/?text=...')

copyVideoLink()
  ├─ renderVideoInBackground() [if needed]
  ├─ showShareLoadingModal(true)
  ├─ pollRenderJob(jobId) [wait for render]
  ├─ closeShareLoadingModal()
  ├─ getShareableVideoUrl()
  └─ navigator.clipboard.writeText(url)
```

---

This completes the visual documentation of the entire share flow redesign!
