# 🚀 Quick Start - Deploy to Render (5 minutes)

## Step 1: Push to GitHub

```bash
# If you haven't already
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Select your repository

### Configuration:
- **Name:** `videoframer` (or your choice)
- **Environment:** `Docker` ⭐ (Use Dockerfile method)
- **Plan:** `Free`
- **Dockerfile Path:** `Dockerfile`
- **Docker Context:** `.`

### Environment Variables:
- `NODE_ENV` = `production`
- `PORT` = `10000` (Render sets this automatically)

6. Click **"Create Web Service"**
7. Wait 5-10 minutes for first deployment
8. Done! 🎉

Your app will be live at: `https://videoframer.onrender.com`

---

## ⚡ Alternative: Railway (No spin-down)

1. Go to https://railway.app
2. Sign up with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway auto-detects Dockerfile
6. Add environment variable: `NODE_ENV=production`
7. Deploy!

Railway gives you $5 free credit/month and doesn't spin down.

---

## 📝 Notes

- **Render free tier:** Spins down after 15 min inactivity (first request may be slow)
- **Railway:** Better for always-on service, requires credit card (won't charge if you stay within free tier)
- Both platforms will automatically install FFmpeg and yt-dlp via the Dockerfile

---

## 🐛 Troubleshooting

**Build fails?**
- Check build logs in Render/Railway dashboard
- Make sure Dockerfile is in root directory
- Verify all files are committed to GitHub

**App doesn't work?**
- Check logs in dashboard
- Test health endpoint: `https://your-app-url.com/api/health`
- Verify environment variables are set

**Need help?** Check `DEPLOYMENT.md` for detailed instructions.
