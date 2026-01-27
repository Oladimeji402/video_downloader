# Dockerfile for VideoFramer
# Can be used with Fly.io, Railway, Render, or any Docker-based platform

FROM node:18-slim

# Install FFmpeg and Python (for yt-dlp)
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install --break-system-packages yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install

# Copy application files
COPY backend/ ./
COPY frontend/ ../frontend/

# Create temp directories
RUN mkdir -p temp/downloads temp/rendered

# Expose port (will be overridden by platform)
EXPOSE 8080

# Set PORT environment variable
ENV PORT=8080

# Start the application
CMD ["node", "index.js"]
