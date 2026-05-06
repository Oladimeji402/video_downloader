# 🚀 Deployment Guide - VideoFramer

This guide covers deployment to **Render (backend)** and **Vercel (frontend)** free tiers.

## 🎯 Deployment Strategy

**Backend (API)**: Deploy to Render
- Handles video processing (FFmpeg, yt-dlp)
- Needs system dependencies
- Free tier with cold starts

**Frontend (UI)**: Deploy to Vercel
- Static files served via CDN
- Fast global delivery
- Always-on (no cold starts)

---

## 📋 Prerequisites

1. **GitHub Account** - Push your code to GitHub
2. **Render Account** - For backend API
3. **Vercel Account** - For frontend UI

---

## Part 1: Deploy Backend to Render

### Step 1: Prepare Backend for Render

The backend is already configured with `render.yaml` and `Dockerfile`.

**Important Files**:
- `Dockerfile` - Installs FFmpeg, yt-dlp, and Node.js dependencies
- `render.yaml` - Render configuration (optional)

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 3: Create Render Web Service

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Sign up/login** with GitHub
3. **Click "New +"** → **"Web Service"**
4. **Connect your GitHub repository**

### Step 4: Configure Render Service

**Basic Settings**:
- **Name**: `videoframer-api` (or any name)
- **Environment**: `Docker`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Dockerfile Path**: `Dockerfile`
- **Docker Context**: `.` (root directory)

**Instance Type**:
- **Plan**: `Free` (⚠️ Spins down after 15 min inactivity)

**Environment Variables**:
```
PORT=10000
NODE_ENV=production
```

**Advanced Settings** (Optional):
- **Health Check Path**: `/api/health`
- **Auto-Deploy**: `Yes` (deploys on git push)

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for first deployment
3. Your API will be live at: `https://videoframer-api.onrender.com`

### Step 6: Test Backend

Visit: `https://your-app-name.onrender.com/api/health`

Should return:
```json
{
  "status": "ok",
  "message": "Video Framer API is running",
  "timestamp": "2026-05-06T..."
}
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Update Frontend Configuration

Update `frontend/env.js` with your Render backend URL:

```javascript
window.ENV = {
  API_URL: "https://videoframer-api.onrender.com/api"
};
```

**Commit the change**:
```bash
git add frontend/env.js
git commit -m "Update API URL for production"
git push
```

### Step 2: Deploy to Vercel

**Option A: Vercel CLI (Recommended)**

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd frontend
   vercel
   ```

4. **Follow prompts**:
   - Set up and deploy? `Y`
   - Which scope? (Choose your account)
   - Link to existing project? `N`
   - Project name? `videoframer`
   - Directory? `./` (current directory)
   - Override settings? `N`

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

**Option B: Vercel Dashboard**

1. **Go to Vercel**: https://vercel.com
2. **Sign up/login** with GitHub
3. **Click "Add New..."** → **"Project"**
4. **Import your GitHub repository**
5. **Configure Project**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `frontend`
   - **Build Command**: (leave empty)
   - **Output Directory**: `./` (current directory)
   - **Install Command**: (leave empty)
6. **Click "Deploy"**

### Step 3: Configure Vercel

**vercel.json** (already configured):
```json
{
  "version": 2,
  "public": true,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" }
      ]
    }
  ]
}
```

### Step 4: Test Frontend

Visit: `https://videoframer.vercel.app` (or your custom domain)

---

## 🔧 Important: CORS Configuration

Update backend CORS to allow Vercel domain:

**Edit `backend/index.js`**:
```javascript
const corsOptions = {
  origin: [
    "https://videoframer.vercel.app",  // Your Vercel domain
    "https://your-custom-domain.com",  // If you have one
    "http://localhost:3000",
    "http://localhost:4000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200,
};
```

**Commit and push**:
```bash
git add backend/index.js
git commit -m "Update CORS for Vercel"
git push
```

Render will auto-deploy the backend update.

---

## ⚡ Render Free Tier Optimizations

### Cold Start Handling

**Problem**: Render free tier spins down after 15 minutes of inactivity. First request takes 30-60 seconds.

**Solution**: Frontend already handles this!

The app shows a "Waking up server..." banner and pings the server every 14 minutes to keep it warm.

**In `frontend/script.js`**:
```javascript
// Ping server every 14 min to prevent cold starts
setInterval(() => {
  fetch(`${API_BASE}/health`).catch(() => {});
}, 14 * 60 * 1000);
```

### Performance Tips

1. **Keep videos short** - 3-minute limit helps
2. **Use background pre-rendering** - Already implemented
3. **Optimize FFmpeg settings** - Already done (veryfast preset)
4. **Monitor usage** - Check Render dashboard

---

## 📊 Free Tier Limitations

### Render Free Tier
- ✅ 750 hours/month (enough for 24/7)
- ⚠️ Spins down after 15 min inactivity
- ⚠️ 512 MB RAM
- ⚠️ 0.1 CPU
- ⚠️ Slower than paid tiers

**Expected Performance**:
- Cold start: 30-60 seconds
- Warm requests: Normal speed
- Video processing: Slower than local

### Vercel Free Tier
- ✅ 100 GB bandwidth/month
- ✅ Always-on (no cold starts)
- ✅ Global CDN
- ✅ Fast static file serving
- ✅ Unlimited requests

---

## 🐛 Troubleshooting

### Backend Issues

**"Server unavailable"**
- Wait 30-60 seconds for cold start
- Check Render logs for errors
- Verify environment variables

**"FFmpeg not found"**
- Check Dockerfile includes FFmpeg
- Review build logs in Render dashboard
- Ensure Docker build completed successfully

**"yt-dlp not found"**
- Check Dockerfile includes yt-dlp
- Verify Python3 and pip installed
- Check build logs

**"Rate limit exceeded"**
- Render free tier has bandwidth limits
- Monitor usage in dashboard
- Consider upgrading if needed

### Frontend Issues

**"Failed to connect to server"**
- Check `frontend/env.js` has correct API URL
- Verify CORS settings in backend
- Check browser console for errors

**"CORS error"**
- Update backend CORS to include Vercel domain
- Redeploy backend after CORS update
- Clear browser cache

**Static files not loading**
- Check `vercel.json` configuration
- Verify root directory is `frontend`
- Check Vercel deployment logs

### Video Processing Issues

**"Video is too long"**
- 3-minute limit enforced
- User sees clear error message
- No action needed

**"Rendering timeout"**
- Render free tier is slower
- Long videos may timeout
- Recommend shorter videos to users

**"Download failed"**
- Check yt-dlp is up to date
- Some platforms block downloads
- Try different video source

---

## 🚀 Deployment Checklist

### Backend (Render)
- [ ] Code pushed to GitHub
- [ ] Render web service created
- [ ] Docker environment selected
- [ ] Environment variables set
- [ ] Health check endpoint working
- [ ] CORS configured for Vercel domain
- [ ] Test video download
- [ ] Test video rendering

### Frontend (Vercel)
- [ ] `env.js` updated with Render API URL
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Root directory set to `frontend`
- [ ] Deployment successful
- [ ] Test UI loads
- [ ] Test video processing end-to-end
- [ ] Test on mobile devices

---

## 🎯 Production URLs

After deployment, you'll have:

- **Frontend**: `https://videoframer.vercel.app`
- **Backend API**: `https://videoframer-api.onrender.com`
- **Health Check**: `https://videoframer-api.onrender.com/api/health`

Share the **frontend URL** with users!

---

## 💡 Tips for Free Tier Success

### Keep Costs Zero
1. ✅ Stay within bandwidth limits
2. ✅ Monitor Render dashboard
3. ✅ Use 3-minute video limit
4. ✅ Implement rate limiting (already done)

### Improve Performance
1. ✅ Keep server warm (14-min ping implemented)
2. ✅ Use background pre-rendering (implemented)
3. ✅ Optimize FFmpeg settings (done)
4. ✅ Show clear progress feedback (done)

### User Experience
1. ✅ Show "Waking up server" banner (implemented)
2. ✅ Display clear error messages (implemented)
3. ✅ Show progress percentages (implemented)
4. ✅ Set expectations (3-min limit, processing time)

---

## 📈 Monitoring

### Render Dashboard
- Check deployment logs
- Monitor resource usage
- View request metrics
- Check error logs

### Vercel Dashboard
- View deployment status
- Check bandwidth usage
- Monitor function invocations
- Review analytics

---

## 🔄 Updating Your App

### Update Backend
```bash
git add .
git commit -m "Update backend"
git push
```
Render auto-deploys on push.

### Update Frontend
```bash
git add .
git commit -m "Update frontend"
git push
```
Vercel auto-deploys on push.

---

## 🆙 Upgrading (If Needed)

### When to Upgrade Render
- Cold starts are too slow
- Need more processing power
- Higher traffic volume
- Need always-on service

**Render Starter Plan**: $7/month
- No cold starts
- More RAM and CPU
- Better performance

### When to Upgrade Vercel
- Exceed 100 GB bandwidth
- Need custom domains
- Need more team members

**Vercel Pro**: $20/month
- 1 TB bandwidth
- Custom domains
- Priority support

---

## 📝 Notes

- **Cold starts are normal** on Render free tier
- **Frontend is always fast** (Vercel CDN)
- **Backend warms up** after first request
- **Keep-alive ping** reduces cold starts
- **3-minute limit** prevents timeouts
- **Rate limiting** prevents abuse

---

## ✅ Success Criteria

Your deployment is successful when:
- ✅ Frontend loads instantly
- ✅ Backend responds (after cold start)
- ✅ Videos download successfully
- ✅ Frames render correctly
- ✅ Downloads work
- ✅ Share functions work
- ✅ Error messages are clear
- ✅ Progress bars show correctly

---

**Need Help?**
- Check Render logs for backend issues
- Check Vercel logs for frontend issues
- Check browser console for client errors
- Review error messages (they're helpful now!)
