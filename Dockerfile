# Dockerfile for VideoFramer
# Optimized for Railway deployment

FROM node:20-slim

# Install FFmpeg and Python (for yt-dlp)
# Sharp requires some native dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy application files
COPY backend/ ./
COPY frontend/ ../frontend/

# Create temp directories
RUN mkdir -p temp/downloads temp/rendered temp/uploads

# Create frames directory if needed
RUN mkdir -p frames

# Expose port (Railway will override with $PORT)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "index.js"]
