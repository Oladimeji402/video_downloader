# 🧠 Memory Optimizations for Free-Tier Hosting

## Problem
Render free tier provides only **512MB RAM**, causing out-of-memory errors during video processing.

## Solutions Applied

### 1. **Reduced Video Resolution**
- **Before**: 540p max resolution
- **After**: 360p max resolution
- **Impact**: ~40% less memory usage, faster encoding

### 2. **Limited FFmpeg Memory Usage**
- Added `-bufsize 512k` - Limits buffer size
- Added `-maxrate 1M` - Limits bitrate
- Changed `-threads 0` to `-threads 2` - Limits concurrent processing
- Increased CRF from 30 to 32 - Faster encoding, less memory

### 3. **Reduced Download Buffer**
- Changed `--max-filesize` from 500M to 200M
- Added `--buffer-size 16K` to yt-dlp
- Limits memory during download phase

### 4. **Node.js Memory Limits**
- Set `--max-old-space-size=450` (450MB limit)
- Leaves 62MB for system overhead
- Prevents Node.js from exceeding container limits

### 5. **Removed Sharp Preprocessing**
- Already done in previous optimization
- Saves memory by doing everything in FFmpeg

## Expected Results

### Memory Usage:
- **Before**: 600-800MB (crashed on 512MB limit)
- **After**: 350-450MB (fits in 512MB with headroom)

### Performance:
- Slightly faster due to lower resolution
- More stable (no crashes)
- Better for free-tier hosting

### Quality Trade-offs:
- 360p instead of 540p (still good for social media)
- Slightly lower video quality (CRF 32 vs 30)
- Still acceptable for Instagram/TikTok/WhatsApp

## Testing Checklist

- [ ] Test with 30-second video
- [ ] Test with 1-minute video
- [ ] Test with 2-minute video
- [ ] Monitor memory usage in Render logs
- [ ] Verify no out-of-memory errors
- [ ] Check video quality is acceptable

## Monitoring

Check Render logs for:
```
Memory usage: XXX MB / 512 MB
```

Should stay under 450MB consistently.

## If Still Having Issues

### Further Optimizations:
1. Lower resolution to 240p
2. Increase CRF to 35
3. Limit video duration to 1 minute
4. Process in smaller chunks

### Upgrade Options:
- **Render**: $7/mo for 1GB RAM
- **Railway**: $5/mo for better resources
- **Fly.io**: Better memory handling

## Notes

- These optimizations prioritize **stability over quality**
- Perfect for free-tier hosting
- Videos still look good on mobile devices
- Can be reverted if you upgrade to paid hosting

---

**Last Updated**: May 14, 2026
**Optimized For**: Render Free Tier (512MB RAM)
