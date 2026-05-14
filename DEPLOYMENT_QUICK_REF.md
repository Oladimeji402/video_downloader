# 🚀 Quick Deployment Reference

## Railway (Backend) - Recommended

### Option 1: Via Dashboard (Easiest)
1. Go to [railway.app/new](https://railway.app/new)
2. Select "Deploy from GitHub repo"
3. Choose `Oladimeji402/video_downloader`
4. Wait for deployment
5. Copy your Railway URL

### Option 2: Via CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Environment Variables (Optional)
```
PORT=8080
NODE_ENV=production
```

### Your Railway URL
After deployment, you'll get: `https://your-app.up.railway.app`

---

## Vercel (Frontend)

### Deploy Frontend
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory**: `frontend`
4. Deploy

### Update API URL
Before deploying frontend, edit `frontend/env.js`:
```javascript
window.ENV = {
  API_URL: "https://your-app.up.railway.app/api"  // Your Railway URL
};
```

---

## Testing Deployment

### 1. Test Backend Health
```bash
curl https://your-app.up.railway.app/api/health
```

Should return:
```json
{"status":"ok","message":"Video Framer API is running"}
```

### 2. Test Frontend
Open your Vercel URL and try:
- Paste a video URL
- Download video
- Add frame overlay
- Share to WhatsApp

---

## Common Issues

### CORS Error
Add your Vercel URL to `backend/index.js`:
```javascript
origin: [
  "https://your-frontend.vercel.app",  // Add this
  // ... other origins
]
```

### Slow Performance
- Expected on free tier
- Cold starts take 10-30s
- Consider Railway $5/mo plan for better performance

### Build Fails
- Check Railway logs in dashboard
- Verify all files committed to GitHub
- Check Dockerfile syntax

---

## Cost Summary

| Service | Cost | What For |
|---------|------|----------|
| Railway | $5 credit/mo (free) | Backend API |
| Vercel | Free forever | Frontend hosting |
| **Total** | **$0/month** | Full app |

*Railway requires credit card but won't charge unless you exceed $5 credit*

---

## Quick Commands

```bash
# View Railway logs
railway logs

# Open Railway dashboard
railway open

# Redeploy
git push origin main  # Auto-deploys on Railway

# Check Railway status
railway status
```

---

## Support

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Your Repo: https://github.com/Oladimeji402/video_downloader
