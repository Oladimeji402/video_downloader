/**
 * Generate sample frame PNG images
 * Run: node scripts/generate-frames.js
 * 
 * Requires: npm install canvas
 */

import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRAMES_DIR = path.join(__dirname, "..", "frames");

// Ensure frames directory exists
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

// Frame configurations
const frames = [
  {
    id: "frame-blue",
    name: "Ocean Blue",
    borderWidth: 20,
    borderColor: "#3b82f6",
    cornerRadius: 16,
  },
  {
    id: "frame-gold",
    name: "Royal Gold",
    borderWidth: 24,
    borderColor: "#fbbf24",
    cornerRadius: 12,
  },
  {
    id: "frame-neon",
    name: "Neon Glow",
    borderWidth: 8,
    borderColor: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.5)",
    glowSize: 15,
    cornerRadius: 8,
  },
  {
    id: "frame-pink",
    name: "Rose Pink",
    borderWidth: 18,
    borderColor: "#ec4899",
    cornerRadius: 20,
  },
  {
    id: "frame-gradient",
    name: "Rainbow Gradient",
    borderWidth: 16,
    gradientColors: ["#6366f1", "#22d3ee", "#f472b6"],
    cornerRadius: 14,
  },
  {
    id: "frame-vintage",
    name: "Vintage",
    borderWidth: 30,
    borderColor: "#92400e",
    innerBorderWidth: 4,
    innerBorderColor: "#fbbf24",
    cornerRadius: 4,
  },
];

// Canvas dimensions (9:16 aspect ratio like TikTok)
const WIDTH = 1080;
const HEIGHT = 1920;

function generateFrame(config) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const bw = config.borderWidth;
  const cr = config.cornerRadius;

  // Draw border
  ctx.beginPath();
  
  // Outer rounded rectangle
  roundedRect(ctx, 0, 0, WIDTH, HEIGHT, cr);
  
  // Inner rounded rectangle (cutout)
  roundedRectReverse(ctx, bw, bw, WIDTH - bw * 2, HEIGHT - bw * 2, Math.max(0, cr - bw / 2));
  
  // Fill the border area
  if (config.gradientColors) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    config.gradientColors.forEach((color, i) => {
      gradient.addColorStop(i / (config.gradientColors.length - 1), color);
    });
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = config.borderColor;
  }
  
  ctx.fill("evenodd");

  // Add glow effect if specified
  if (config.glowColor && config.glowSize) {
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = config.glowSize;
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = config.borderWidth;
    
    ctx.beginPath();
    roundedRect(ctx, bw / 2, bw / 2, WIDTH - bw, HEIGHT - bw, cr - bw / 4);
    ctx.stroke();
  }

  // Add inner border if specified
  if (config.innerBorderWidth && config.innerBorderColor) {
    ctx.strokeStyle = config.innerBorderColor;
    ctx.lineWidth = config.innerBorderWidth;
    
    const ibw = config.innerBorderWidth;
    ctx.beginPath();
    roundedRect(ctx, bw - ibw / 2, bw - ibw / 2, WIDTH - bw * 2 + ibw, HEIGHT - bw * 2 + ibw, cr - bw / 2);
    ctx.stroke();
  }

  // Save the frame
  const buffer = canvas.toBuffer("image/png");
  const outputPath = path.join(FRAMES_DIR, `${config.id}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated: ${config.id}.png`);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundedRectReverse(ctx, x, y, w, h, r) {
  // Draw in reverse (counter-clockwise) for proper hole
  ctx.moveTo(x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.lineTo(x, y + h - r);
  ctx.quadraticCurveTo(x, y + h, x + r, y + h);
  ctx.lineTo(x + w - r, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  ctx.lineTo(x + w, y + r);
  ctx.quadraticCurveTo(x + w, y, x + w - r, y);
  ctx.lineTo(x + r, y);
  ctx.closePath();
}

// Generate all frames
console.log("\n📐 Generating frame templates...\n");
frames.forEach(generateFrame);
console.log("\n✅ All frames generated successfully!\n");
