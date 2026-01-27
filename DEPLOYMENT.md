# 🚀 Deployment Guide - VideoFramer

This guide will help you deploy VideoFramer to free hosting platforms so your boss can access it anytime.

## 📋 Prerequisites

1. **GitHub Account** - You'll need to push your code to GitHub
2. **Account on hosting platform** (Render, Railway, or Fly.io)

---

## Option 1: Render (Recommended - Easiest)

**Pros:**
- ✅ Free tier available
- ✅ Easy setup with GitHub integration
- ✅ Automatic deployments
- ✅ Can install system dependencies (FFmpeg, yt-dlp)

**Cons:**
- ⚠️ Free tier spins down after 15 min inactivity (first request may be slow)
- ⚠️ Limited resources on free tier

### Steps:

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Go to Render Dashboard:**
   - Visit: https://dashboard.render.com
   - Sign up/login with GitHub

3. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

4. **Configure Service (Method A - Using Dockerfile - Recommended):**
   - **Name:** `videoframer` (or any name you like)
   - **Environment:** `Docker`
   - **Region:** Choose closest to you
   - **Branch:** `main` (or your default branch)
   - **Dockerfile Path:** `Dockerfile`
   - **Docker Context:** `.` (root directory)
   - **Plan:** `Free`

5. **Configure Service (Method B - Native Node.js):**
   - **Name:** `videoframer`
   - **Environment:** `Node`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
   - ⚠️ **Note:** For Method B, you'll need to add FFmpeg and yt-dlp via a buildpack or use a custom Dockerfile

6. **Environment Variables:**
   - `PORT`: `10000` (Render sets this automatically)
   - `NODE_ENV`: `production`

7. **Click "Create Web Service"**

8. **Wait for deployment** (first deploy takes 5-10 minutes)

9. **Your app will be live at:** `https://videoframer.onrender.com` (or your custom name)

---

## Option 2: Railway

**Pros:**
- ✅ $5 free credit per month
- ✅ More resources than Render free tier
- ✅ Doesn't spin down

**Cons:**
- ⚠️ Requires credit card (but won't charge if you stay within free tier)

### Steps:

1. **Push code to GitHub** (same as Render)

2. **Go to Railway:**
   - Visit: https://railway.app
   - Sign up with GitHub

3. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

4. **Configure Service for Docker:**
   - Railway should auto-detect the Dockerfile
   - If it doesn't, go to **Settings** → **Service** → **Source**
   - Make sure **Dockerfile Path** is set to `Dockerfile`
   - **IMPORTANT:** Do NOT set a custom Start Command in Railway settings
   - The Dockerfile CMD will handle the start command automatically
   - Remove any Start Command if Railway auto-detected Node.js (this causes the `cd` error)

6. **Environment Variables:**
   - `PORT`: Railway sets this automatically
   - `NODE_ENV`: `production`

7. **Deploy!**

---

## Option 3: Fly.io

**Pros:**
- ✅ Generous free tier
- ✅ Good performance
- ✅ Global edge network

**Cons:**
- ⚠️ More complex setup
- ⚠️ Requires Fly CLI

### Steps:

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create fly.toml** (I'll create this for you)

4. **Deploy:**
   ```bash
   fly deploy
   ```

---

## 🔧 Post-Deployment Checklist

After deploying, make sure to:

1. ✅ Test the health endpoint: `https://your-app-url.com/api/health`
2. ✅ Test downloading a video
3. ✅ Test frame rendering
4. ✅ Share the URL with your boss!

---

## 🐛 Troubleshooting

### "FFmpeg not found"
- Make sure build command includes FFmpeg installation
- Check build logs in your hosting dashboard

### "yt-dlp not found"
- Ensure Python3 and pip are installed in build command
- Verify yt-dlp installation: `pip3 install yt-dlp`

### App spins down (Render free tier)
- First request after inactivity takes ~30 seconds
- Consider upgrading to paid tier for always-on service
- Or use Railway/Fly.io which don't spin down

### Port issues
- Render uses port 10000 (set in env var)
- Railway/Fly.io set PORT automatically
- Your code already handles this with `process.env.PORT || 4000`

---

## 💡 Recommendation

For your use case (boss needs to use it anytime), I recommend:

1. **Railway** - Best balance of free tier and reliability
2. **Render** - Easiest setup, but spins down
3. **Fly.io** - Most powerful, but more setup

---

## 📝 Notes

- Free tiers have limitations (memory, CPU, storage)
- Video processing is resource-intensive - large videos may timeout
- Consider upgrading if you need more reliability
- Monitor usage to stay within free tier limits
