// server/lib/redis.ts
// Redis client — only connects when REDIS_URL is set.
// When absent (local dev), all callers fall back to in-memory behaviour.
import Redis from "ioredis";

let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisClient.on("error", (err) => {
    console.error("[Redis] connection error:", err.message);
  });

  redisClient.on("connect", () => {
    console.log("[Redis] connected");
  });
}

export { redisClient };
