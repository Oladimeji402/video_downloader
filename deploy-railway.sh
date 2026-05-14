#!/bin/bash

# Railway Deployment Helper Script
# This script helps you deploy to Railway

echo "🚂 Railway Deployment Helper"
echo "=============================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Or deploy via Railway dashboard:"
    echo "  https://railway.app/new"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway:"
    railway login
fi

echo ""
echo "📦 Current configuration:"
echo "  - Builder: Dockerfile"
echo "  - Port: 8080"
echo "  - Health check: /api/health"
echo ""

# Ask for confirmation
read -p "Deploy to Railway? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Deploying to Railway..."
    railway up
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Get your Railway URL from dashboard"
    echo "  2. Update frontend/env.js with your Railway URL"
    echo "  3. Deploy frontend to Vercel"
    echo ""
    echo "View logs: railway logs"
    echo "Open dashboard: railway open"
else
    echo ""
    echo "❌ Deployment cancelled"
fi
