# Render + Vercel Deployment Guide

Complete step-by-step guide for deploying VideoFramer on free tiers.

## 🎯 Architecture

```
User Browser
    ↓
Vercel (Frontend - Always Fast)
    ↓
Render (Backend - May cold start)
    ↓
FFmpeg + yt-dlp processing
```

## 📦 What You're Deploying

- **Frontend** → Vercel (HTML, CSS, JS)
- **Backend** → Render (Node.js, FFmpeg, yt-dlp)

---

## Part 1: Deploy Backend to Render (15 minutes)

### Step 1: Prepare Your Code

Make sure you have these files:
- ✅ `Dockerfile` (installs FFmpeg, yt-dlp)
- ✅ `backend/package.json`
- ✅ `backend/index.js`

### Step 2: Push to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"

# Add your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push
git push -u origin main
```

### Step 3: Create Render Account

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub
4. Authorize Render to access your repositories

### Step 4: Create Web Service

1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. Click **"Connect account"** if needed
4. Find your repository in the list
5. Click **"Connect"**

### Step 5: Configure Service

**Basic Configuration**:
```
Name: videoframer-api
Environment: Docker
Region: Oregon (US West) or closest to you
Branch: main
```

**Docker Configuration**:
```
Dockerfile Path: Dockerfile
Docker Context: . (root directory)
Docker Command: (leave empty - uses Dockerfile CMD)
```

**Instance Type**:
```
Plan: Free
```

**Advanced Settings** (click "Advanced"):
```
Health Check Path: /api/health
Auto-Deploy: Yes
```

### Step 6: Environment Variables

Click **"Add Environment Variable"**:

```
PORT = 10000
NODE_ENV = production
```

### Step 7: Deploy

1. Click **"Create Web Service"**
2. Wait for build (5-10 minutes first time)
3. Watch the logs for any errors

**Build Progress**:
- Installing system dependencies (FFmpeg, Python)
- Installing Node.js dependencies
- Building Docker image
- Starting service

### Step 8: Test Backend

Once deployed, visit:
```
https://your-service-name.onrender.com/api/health
```

Should see:
```json
{
  "status": "ok",
  "message": "Video Framer API is running",
  "timestamp": "2026-05-06T...",
  "uptime": 123.45,
  "platform": "render-free-tier"
}
```

**Copy this URL** - you'll need it for frontend!

---

## Part 2: Deploy Frontend to Vercel (10 minutes)

### Step 1: Update API URL

Edit `frontend/env.js`:

```javascript
window.ENV = {
  API_URL: "https://your-service-name.onrender.com/api"
};
```

**Replace** `your-service-name` with your actual Render service name!

### Step 2: Commit Changes

```bash
git add frontend/env.js
git commit -m "Update API URL for production"
git push
```

### Step 3: Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up"
3. Sign up with GitHub
4. Authorize Vercel

### Step 4: Import Project

1. Click **"Add New..."** → **"Project"**
2. Find your repository
3. Click **"Import"**

### Step 5: Configure Project

**Framework Preset**: Other

**Root Directory**: Click "Edit" → Select `frontend`

**Build Settings**:
```
Build Command: (leave empty)
Output Directory: ./
Install Command: (leave empty)
```

**Environment Variables**: None needed

### Step 6: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes
3. Your site is live!

### Step 7: Get Your URL

Vercel will give you a URL like:
```
https://your-project-name.vercel.app
```

**This is your public URL!** Share it with users.

---

## Part 3: Update CORS (Important!)

### Step 1: Update Backend CORS

Edit `backend/index.js`, find the `corsOptions` section:

```javascript
const corsOptions = {
  origin: [
    "https://your-project-name.vercel.app",  // ADD THIS LINE
    "https://videoframer.vercel.app",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200,
};
```

### Step 2: Deploy Update

```bash
git add backend/index.js
git commit -m "Add Vercel domain to CORS"
git push
```

Render will automatically redeploy (takes 2-3 minutes).

---

## 🧪 Testing Your Deployment

### Test 1: Frontend Loads
Visit: `https://your-project-name.vercel.app`
- ✅ Page loads instantly
- ✅ Green and white theme
- ✅ No console errors

### Test 2: Backend Wakes Up
1. Paste a TikTok URL
2. Click "Go"
3. See "Waking up server..." banner (first time)
4. Wait 30-60 seconds
5. Video should download

### Test 3: Frame Rendering
1. Select a frame
2. Click "Download"
3. See "Rendering... X%" progress
4. Download should start

### Test 4: Error Handling
1. Try a 4-minute video
2. Should see: "Video is too long. Maximum 3 minutes allowed."

---

## 🔥 Understanding Render Free Tier

### Cold Starts

**What happens**:
- After 15 minutes of no requests, Render spins down your service
- Next request takes 30-60 seconds to wake up
- Subsequent requests are fast

**How we handle it**:
- Frontend shows "Waking up server..." banner
- Frontend pings server every 14 minutes to keep it warm
- Users see clear feedback during cold start

**Code that keeps server warm**:
```javascript
// In frontend/script.js
setInterval(() => {
  fetch(`${API_BASE}/health`).catch(() => {});
}, 14 * 60 * 1000); // Every 14 minutes
```

### Resource Limits

**Render Free Tier**:
- 512 MB RAM
- 0.1 CPU (shared)
- 750 hours/month (enough for 24/7)
- Spins down after 15 min inactivity

**What this means**:
- ✅ Can handle 1-2 concurrent users
- ✅ Good for personal/demo use
- ⚠️ Slower video processing
- ⚠️ May timeout on very long videos
- ⚠️ Cold starts are normal

### Performance Expectations

| Operation | Cold Start | Warm |
|-----------|-----------|------|
| Health check | 30-60s | <1s |
| Download video | 30-60s + download time | Download time only |
| Render 30s video | 30-60s + 40-60s | 40-60s |
| Render 2min video | 30-60s + 2-4min | 2-4min |

---

## 🎯 Optimizations Already Implemented

### Frontend Optimizations
✅ Server wake-up detection
✅ Keep-alive pings every 14 minutes
✅ Background pre-rendering
✅ Progress feedback
✅ Error handling with retry suggestions

### Backend Optimizations
✅ 3-minute video duration limit
✅ Resolution capped at 720p
✅ FFmpeg "veryfast" preset
✅ Sharp image preprocessing (10x faster)
✅ Automatic file cleanup (30 min)
✅ Rate limiting (20 videos/hour)
✅ In-memory job queue (no Redis needed)

---

## 🐛 Common Issues & Solutions

### Issue: "Failed to connect to server"

**Cause**: CORS not configured or wrong API URL

**Solution**:
1. Check `frontend/env.js` has correct Render URL
2. Check `backend/index.js` CORS includes Vercel domain
3. Redeploy both if changed

### Issue: "Server unavailable"

**Cause**: Cold start or server error

**Solution**:
1. Wait 60 seconds for cold start
2. Check Render logs for errors
3. Verify Render service is running

### Issue: "Video is too long"

**Cause**: Video exceeds 3-minute limit

**Solution**:
- This is expected behavior
- User sees clear error message
- Recommend shorter videos

### Issue: "Rendering timeout"

**Cause**: Render free tier is slow for long videos

**Solution**:
- Recommend videos under 2 minutes
- Consider upgrading Render plan
- Or accept longer processing times

### Issue: Cold starts are too slow

**Cause**: Render free tier limitation

**Solutions**:
1. Keep-alive pings (already implemented)
2. Upgrade to Render Starter ($7/month - no cold starts)
3. Accept 30-60s first request delay

---

## 📊 Monitoring Your Deployment

### Render Dashboard

**View Logs**:
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. See real-time logs

**Check Metrics**:
1. Click "Metrics" tab
2. See CPU, memory, bandwidth usage
3. Monitor for issues

**View Events**:
1. Click "Events" tab
2. See deployments, restarts, errors

### Vercel Dashboard

**View Deployments**:
1. Go to Vercel dashboard
2. Click your project
3. See deployment history

**Check Analytics**:
1. Click "Analytics" tab
2. See page views, performance
3. Monitor bandwidth usage

**View Logs**:
1. Click "Logs" tab
2. See function invocations
3. Debug errors

---

## 🔄 Updating Your App

### Update Backend

```bash
# Make changes to backend files
git add .
git commit -m "Update backend"
git push
```

Render auto-deploys in 2-3 minutes.

### Update Frontend

```bash
# Make changes to frontend files
git add .
git commit -m "Update frontend"
git push
```

Vercel auto-deploys in 30-60 seconds.

### Update Both

```bash
# Make changes to any files
git add .
git commit -m "Update app"
git push
```

Both deploy automatically!

---

## 💰 Staying on Free Tier

### Render Free Tier Limits
- ✅ 750 hours/month (24/7 coverage)
- ✅ 100 GB bandwidth/month
- ✅ Unlimited builds

**How to stay within limits**:
- ✅ 3-minute video limit (implemented)
- ✅ Rate limiting (implemented)
- ✅ Automatic file cleanup (implemented)
- ✅ Monitor dashboard regularly

### Vercel Free Tier Limits
- ✅ 100 GB bandwidth/month
- ✅ Unlimited requests
- ✅ Unlimited deployments

**How to stay within limits**:
- ✅ Frontend is lightweight
- ✅ Videos served from Render, not Vercel
- ✅ Should easily stay under 100 GB

---

## 🆙 When to Upgrade

### Upgrade Render if:
- ❌ Cold starts are unacceptable
- ❌ Need faster processing
- ❌ Need more concurrent users
- ❌ Exceed bandwidth limits

**Render Starter**: $7/month
- No cold starts
- 512 MB RAM
- 0.5 CPU
- Better performance

### Upgrade Vercel if:
- ❌ Exceed 100 GB bandwidth
- ❌ Need custom domain
- ❌ Need team collaboration

**Vercel Pro**: $20/month
- 1 TB bandwidth
- Custom domains
- Team features

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Code tested locally
- [ ] All files committed to git
- [ ] Pushed to GitHub
- [ ] Dockerfile present
- [ ] vercel.json present

### Render Deployment
- [ ] Render account created
- [ ] Web service created
- [ ] Docker environment selected
- [ ] Environment variables set
- [ ] Service deployed successfully
- [ ] Health check returns OK
- [ ] Logs show no errors

### Vercel Deployment
- [ ] Vercel account created
- [ ] Project imported
- [ ] Root directory set to `frontend`
- [ ] Deployment successful
- [ ] Site loads correctly
- [ ] No console errors

### Integration
- [ ] `frontend/env.js` has Render URL
- [ ] `backend/index.js` CORS has Vercel domain
- [ ] Both services redeployed
- [ ] End-to-end test successful
- [ ] Error handling works
- [ ] Progress bars work

### Final Testing
- [ ] Test video download
- [ ] Test frame rendering
- [ ] Test download
- [ ] Test share
- [ ] Test error messages
- [ ] Test on mobile
- [ ] Test cold start behavior

---

## 🎉 Success!

Your app is now live on:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-service.onrender.com`

**Share the Vercel URL** with users!

---

## 📞 Getting Help

### Check Logs First
- **Render**: Dashboard → Your Service → Logs
- **Vercel**: Dashboard → Your Project → Logs
- **Browser**: F12 → Console tab

### Common Log Messages

**Render Logs**:
```
"Server running on: http://localhost:10000" ✅ Good
"Redis unavailable — using in-memory mode" ✅ Expected
"FFmpeg not found" ❌ Build issue
"yt-dlp not found" ❌ Build issue
```

**Browser Console**:
```
"Failed to fetch" ❌ CORS or API URL issue
"Network error" ❌ Backend down or wrong URL
"200 OK" ✅ Good
```

---

## 🎓 Understanding the Stack

### Why This Architecture?

**Vercel for Frontend**:
- ✅ Global CDN (fast everywhere)
- ✅ Always-on (no cold starts)
- ✅ Free SSL
- ✅ Auto-deploys

**Render for Backend**:
- ✅ Can install FFmpeg, yt-dlp
- ✅ Docker support
- ✅ Free tier available
- ✅ Easy deployment
- ⚠️ Cold starts (acceptable tradeoff)

**Why Not All-in-One?**:
- Vercel can't run FFmpeg (serverless functions)
- Render can serve frontend but Vercel CDN is faster
- Separation of concerns (frontend vs backend)

---

**You're all set! 🚀**

Your VideoFramer app is now deployed on free tiers and ready to use!
