// server/lib/rate-limiters.ts
import rateLimit from "express-rate-limit";
import { redisClient } from "./redis";

export const BULK_DELETE_CAP = 25;

// When Redis is available, use it as the backing store so limits survive
// server restarts. Falls back to in-memory when REDIS_URL is not set or
// rate-limit-redis is not installed.
function makeStore(prefix: string) {
  if (!redisClient) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RedisStore } = require("rate-limit-redis");
    return new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args: string[]) => (redisClient as any).call(...args),
    });
  } catch {
    return undefined;
  }
}

export const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("review"),
  message: { error: "Too many reviews submitted. Please try again in 15 minutes." },
});

export const listingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("listing"),
  message: { error: "Too many listings submitted. Please try again in 15 minutes." },
});

export const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("view"),
  message: { error: "Too many requests." },
});

export const bulkActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("bulk"),
  message: { error: "Too many bulk actions. Please wait 15 minutes." },
});

export const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("delete"),
  message: { error: "Delete rate limit reached. Please wait 15 minutes." },
});

export const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("claim"),
  message: { error: "Too many claim requests. Please try again later." },
});

export const sponsorTrackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("sponsor"),
  message: { error: "Too many requests." },
});
