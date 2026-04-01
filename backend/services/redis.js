import Redis from "ioredis";
import logger from "./logger.js";

let client = null;
let isConnected = false;

export async function initRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      retryStrategy: (times) => {
        if (times > 1) {
          logger.info("Redis unavailable — using in-memory mode (fine for small user count)");
          return null;
        }
        return 500;
      },
    });

    client.on("error", (err) => {
      if (isConnected) {
        logger.error({ error: err.message }, "Redis error");
      }
      isConnected = false;
    });

    client.on("connect", () => {
      logger.info("Redis connected");
      isConnected = true;
    });

    // Wait for connection with timeout
    await Promise.race([
      new Promise((resolve) => client.once("ready", resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout")), 1500))
    ]);

    isConnected = true;
    logger.info("Redis initialized successfully");
    return client;
  } catch (err) {
    logger.warn({ error: err.message }, "Redis connection failed. Running without Redis (in-memory fallback)");
    isConnected = false;
    client = null;
    return null;
  }
}

export function getRedisClient() {
  return client;
}

export function isRedisConnected() {
  return isConnected;
}

export async function closeRedis() {
  if (client) {
    try {
      await client.quit();
      logger.info("Redis disconnected");
    } catch (err) {
      logger.warn({ error: err.message }, "Error closing Redis connection");
    }
  }
}

export default { initRedis, getRedisClient, isRedisConnected, closeRedis };
