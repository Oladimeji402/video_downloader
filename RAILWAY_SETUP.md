# 🚂 Railway Deployment Guide

Complete guide to deploy Video Framer backend on Railway.

## 📋 Prerequisites

- Railway account (sign up at [railway.app](https://railway.app))
- GitHub account (your repo is already connected)
- Credit card for verification (Railway free tier requires it)

## 🚀 Quick Deploy Steps

### 1. **Create New Project on Railway**

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `Oladimeji402/video_downloader`
5. Railway will auto-detect the Dockerfile

### 2. **Configure Environment Variables**

In your Railway project dashboard, go to **Variables** tab and add:

```bash
# Required
PORT=8080
NODE_ENV=production

# Optional - Redis (for better performance)
# Leave empty to use in-memory mode (works fine for small teams)
REDIS_URL=

# Optional - Custom domain
# FRONTEND_URL=https://your-frontend.vercel.app
```

### 3. **Configure Build Settings**

Railway should auto-detect these from `railway.json`, but verify:

- **Builder**: Dockerfile
- **Dockerfile Path**: `Dockerfile`
- **Start Command**: `node index.js`
- **Health Check Path**: `/api/health`

### 4. **Deploy**

1. Click **"Deploy"** button
2. Wait 3-5 minutes for build to complete
3. Railway will provide a URL like: `https://your-app.up.railway.app`

### 5. **Update Frontend to Use Railway Backend**

Edit `frontend/env.js`:

```javascript
// Replace with your Railway URL
window.ENV = {
  API_URL: "https://your-app.up.railway.app/api"
};
```

Then deploy frontend to Vercel/Netlify.

## 🔧 Railway Configuration Files

### ✅ Already Configured:

1. **`railway.json`** - Railway deployment config
2. **`Dockerfile`** - Container build instructions
3. **`backend/package.json`** - Node.js dependencies

## 📊 Railway Free Tier Limits

- **$5 free credit per month** (requires credit card)
- **500 hours of usage** (~20 days if always running)
- **512MB RAM** (good for video processing)
- **1GB storage**
- **100GB bandwidth**

**Tips to stay within free tier:**
- App sleeps after 15min inactivity (good!)
- Cold starts take 10-30 seconds
- Perfect for team use with moderate traffic

## 🎯 Post-Deployment Checklist

- [ ] Backend deployed on Railway
- [ ] Health check working: `https://your-app.up.railway.app/api/health`
- [ ] Frontend updated with Railway URL
- [ ] Frontend deployed to Vercel
- [ ] Test video download
- [ ] Test video framing
- [ ] Test WhatsApp share

## 🐛 Troubleshooting

### Build Fails
- Check Railway logs in dashboard
- Verify Dockerfile syntax
- Ensure all dependencies in package.json

### App Crashes
- Check Railway logs
- Verify PORT environment variable
- Check memory usage (might need upgrade)

### Slow Performance
- Expected on free tier (shared CPU)
- Consider upgrading to $5/mo plan for dedicated resources
- Already optimized for speed (540p, ultrafast preset)

### CORS Errors
- Verify frontend URL in `backend/index.js` CORS config
- Add your Vercel URL to allowed origins

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/mo | $5/mo+ | Best performance |
| **Render** | 750hrs/mo | $7/mo | No credit card |
| **Fly.io** | 3 VMs | $0+ | Good CPU |

## 🔗 Useful Links

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs](https://docs.railway.app)
- [Your GitHub Repo](https://github.com/Oladimeji402/video_downloader)

## 📝 Notes

- Railway auto-deploys on git push to main branch
- Logs available in Railway dashboard
- Can add custom domain (free on Railway)
- Redis optional - app works without it

---

**Need help?** Check Railway logs or open an issue on GitHub.
