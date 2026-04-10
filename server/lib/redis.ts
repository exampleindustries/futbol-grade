// server/lib/redis.ts
// Redis client — only connects when REDIS_URL is set AND ioredis is installed.
// When absent (local dev / no Redis), all callers fall back to in-memory behaviour.

let redisClient: any = null;

if (process.env.REDIS_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    const RedisClass = Redis.default || Redis;
    redisClient = new RedisClass(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redisClient.on("error", (err: Error) => {
      console.error("[Redis] connection error:", err.message);
    });

    redisClient.on("connect", () => {
      console.log("[Redis] connected");
    });
  } catch {
    console.warn("[Redis] ioredis not installed, using in-memory rate limiting");
  }
}

export { redisClient };
