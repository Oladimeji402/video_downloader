# Quick Guide - VideoFramer

## What Changed?

### 🎨 New Design
- **Fresh green & white theme** - Clean, modern, professional
- **Better contrast** - Easier to read
- **Smoother animations** - More polished feel

### 🚨 Better Error Handling
- **3-minute video limit** - Clear error message if exceeded
- **Helpful error messages** - No more generic "failed" messages
- **No infinite loaders** - Always shows what's happening

### 📊 Progress Feedback
- **Download progress** - See percentage while downloading
- **Render progress** - See percentage while rendering
- **Status messages** - Always know what's happening

## User Guide

### Step 1: Paste Video URL
1. Copy a video link from TikTok, Instagram, YouTube, Twitter, or Facebook
2. Paste it in the input field (or click paste button)
3. Click "Go" button

**What you'll see**:
- Progress bar showing download progress
- "Downloading... X%" message
- Video preview when complete

**Possible errors**:
- "Please use a TikTok, Instagram..." - Wrong URL type
- "Video is private or unavailable" - Can't access video
- "Download timed out" - Video too large or slow connection

### Step 2: Select Frame
1. Scroll through available frames
2. Click on a frame to select it
3. See preview with frame overlay

**What happens**:
- Frame overlays on video preview
- Background rendering starts automatically
- Download button becomes active

### Step 3: Download or Share
1. Click "Download" to save video
2. Or click "Share to WhatsApp" to share directly
3. Or use other share options

**What you'll see**:
- "Rendering... X%" if frame selected
- "Downloading... X%" if no frame
- "Download started!" when complete

**Possible errors**:
- "Video is too long. Maximum 3 minutes allowed" - Video >3 min
- "Rendering timed out" - Try shorter video
- "Failed to render video" - Try again or different frame

## Error Messages Explained

### "Video is too long. Maximum 3 minutes allowed."
**Why**: Videos longer than 3 minutes take too long to process
**Solution**: Use a shorter video or trim it before uploading

### "Download timed out. The video might be too large or unavailable."
**Why**: Video download took too long
**Solution**: Check your internet connection or try a different video

### "This video is private or unavailable."
**Why**: The video can't be accessed (private, deleted, or geo-restricted)
**Solution**: Try a different video or check if the link is correct

### "Rate limit reached. You can process 20 videos per hour."
**Why**: Too many videos processed in the last hour
**Solution**: Wait for the time shown, then try again

### "Rendering timed out. Try a shorter video."
**Why**: Rendering took too long (usually very long or complex videos)
**Solution**: Use a shorter or simpler video

### "Server is still starting up, please wait..."
**Why**: Server was asleep (common on free hosting)
**Solution**: Wait 30-60 seconds for server to wake up

## Tips for Best Experience

### ✅ Do's
- Use videos under 3 minutes
- Use stable internet connection
- Wait for progress bars to complete
- Try different frames to see which looks best
- Use the background pre-rendering (it's automatic!)

### ❌ Don'ts
- Don't use videos over 3 minutes
- Don't close the page while processing
- Don't click buttons repeatedly (be patient)
- Don't use private or geo-restricted videos
- Don't process more than 20 videos per hour

## Troubleshooting

### Video won't download
1. Check if URL is from supported platform
2. Verify video is public
3. Check internet connection
4. Try refreshing the page

### Rendering is slow
1. Check video length (shorter = faster)
2. Wait for progress bar (it's working!)
3. Check server isn't overloaded
4. Try a different frame

### Can't share to WhatsApp
1. Check if browser supports Web Share API
2. Try copying link instead
3. On desktop, use WhatsApp Web link
4. On mobile, use native share

### Frame not showing
1. Refresh the page
2. Try a different frame
3. Check if frame loaded (scroll through options)
4. Clear browser cache

## Performance Expectations

| Video Length | Expected Time | What's Happening |
|--------------|---------------|------------------|
| 15 seconds   | 20-30 sec     | Download + Render |
| 30 seconds   | 40-60 sec     | Download + Render |
| 1 minute     | 1-2 minutes   | Download + Render |
| 2 minutes    | 2-4 minutes   | Download + Render |
| 3 minutes    | 3-6 minutes   | Download + Render |
| >3 minutes   | ❌ Error      | Too long |

**Note**: Times vary based on:
- Internet speed (download)
- Server load (render)
- Video complexity (render)
- Video source (download)

## Supported Platforms

✅ **Fully Supported**:
- TikTok
- Instagram (Reels, Posts, Stories)
- YouTube (Videos, Shorts)
- Twitter/X
- Facebook

❌ **Not Supported**:
- Private videos
- Age-restricted videos
- Geo-restricted videos
- Live streams
- Stories (expired)

## Mobile vs Desktop

### Mobile
- ✅ Native share to apps
- ✅ Touch-friendly interface
- ✅ Optimized for small screens
- ⚠️ May be slower on older devices

### Desktop
- ✅ Faster processing
- ✅ Larger preview
- ✅ Easier frame selection
- ⚠️ Share via link only

## Privacy & Data

- ✅ Videos deleted after 30 minutes
- ✅ No data stored permanently
- ✅ No user tracking
- ✅ No login required
- ✅ All processing server-side

## Need Help?

1. Check error message for specific guidance
2. Read this guide for common issues
3. Try refreshing the page
4. Check server status banner at top
5. Wait a few minutes and try again

## Quick Reference

### Keyboard Shortcuts
- `Ctrl/Cmd + V` - Paste URL
- `Enter` - Submit URL
- `Esc` - Close modals (if any)

### Status Indicators
- 🟢 Green progress bar - Processing
- ✅ "Download started!" - Success
- ❌ Red toast - Error
- ⚠️ Yellow toast - Warning
- 🔵 Blue dot - Server starting

### Button States
- **Enabled** - Ready to click
- **Disabled** - Can't click (grayed out)
- **Loading** - Processing (spinner)
- **Progress** - Shows percentage

## Advanced Tips

### Faster Processing
1. Use shorter videos
2. Select frame before downloading (pre-renders)
3. Use stable internet
4. Process during off-peak hours

### Better Quality
1. Use high-quality source videos
2. Choose frames that complement video
3. Ensure good lighting in original video
4. Use landscape or portrait consistently

### Sharing
1. Pre-render by selecting frame early
2. Use native share on mobile
3. Copy link for desktop sharing
4. WhatsApp has file size limits (check if share fails)

## Version Info

- **UI Version**: 2.0 (Green & White Theme)
- **Backend Version**: 1.1 (Performance Optimized)
- **Max Video Duration**: 3 minutes
- **Max File Size**: 500MB
- **Rate Limit**: 20 videos/hour
- **File Retention**: 30 minutes

---

**Last Updated**: May 6, 2026
**Questions?** Check the error message - it's designed to help!
