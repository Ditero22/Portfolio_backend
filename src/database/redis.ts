import { createClient } from "redis";

const storeMode = (process.env.RATE_LIMIT_STORE ?? "memory").toLowerCase();
if (storeMode !== "memory" && storeMode !== "redis") {
  throw new Error('RATE_LIMIT_STORE must be either "memory" or "redis".');
}

const redisUrl = process.env.REDIS_URL;
if (storeMode === "redis" && !redisUrl) {
  throw new Error("REDIS_URL is required when RATE_LIMIT_STORE=redis.");
}

export const redisClient =
  storeMode === "redis"
    ? createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5_000,
          reconnectStrategy: (retries) =>
            retries >= 3
              ? new Error("Rate limit Redis is unavailable.")
              : Math.min(retries * 250, 1_000),
        },
      })
    : null;

redisClient?.on("error", () => {
  console.error("Shared Redis connection error.");
});

export async function connectRedis() {
  if (redisClient && !redisClient.isOpen) await redisClient.connect();
}

export async function closeRedis() {
  if (redisClient?.isOpen) await redisClient.quit();
}
