import { rateLimit, type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { closeRedis, connectRedis, redisClient } from "../database/redis.js";

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function createStore(prefix: string): Store | undefined {
  const client = redisClient;
  if (!client) return undefined;

  return new RedisStore({
    prefix,
    sendCommand: (...args) =>
      client.sendCommand(args) as Promise<
        string | number | boolean | (string | number | boolean)[]
      >,
  });
}

function createRateLimit(options: {
  identifier: string;
  prefix: string;
  windowEnv: string;
  limitEnv: string;
  windowDefault: number;
  limitDefault: number;
}) {
  const store = createStore(options.prefix);

  return rateLimit({
    windowMs: positiveIntegerFromEnv(options.windowEnv, options.windowDefault),
    limit: positiveIntegerFromEnv(options.limitEnv, options.limitDefault),
    identifier: options.identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (_request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.status(429).json({
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      });
    },
  });
}

export const apiRateLimit = createRateLimit({
  identifier: "api",
  prefix: "portfolio:rate-limit:api:",
  windowEnv: "API_RATE_LIMIT_WINDOW_MS",
  limitEnv: "API_RATE_LIMIT_MAX",
  windowDefault: 60_000,
  limitDefault: 120,
});

export const loginRateLimit = createRateLimit({
  identifier: "login",
  prefix: "portfolio:rate-limit:login:",
  windowEnv: "AUTH_LOGIN_RATE_LIMIT_WINDOW_MS",
  limitEnv: "AUTH_LOGIN_RATE_LIMIT_MAX",
  windowDefault: 15 * 60_000,
  limitDefault: 5,
});

export const pinResetRateLimit = createRateLimit({
  identifier: "pin-reset",
  prefix: "portfolio:rate-limit:pin-reset:",
  windowEnv: "AUTH_PIN_RESET_RATE_LIMIT_WINDOW_MS",
  limitEnv: "AUTH_PIN_RESET_RATE_LIMIT_MAX",
  windowDefault: 15 * 60_000,
  limitDefault: 5,
});

export const uploadRateLimit = createRateLimit({
  identifier: "upload",
  prefix: "portfolio:rate-limit:upload:",
  windowEnv: "UPLOAD_RATE_LIMIT_WINDOW_MS",
  limitEnv: "UPLOAD_RATE_LIMIT_MAX",
  windowDefault: 60 * 60_000,
  limitDefault: 12,
});

export async function connectRateLimitStore() {
  await connectRedis();
}

export async function closeRateLimitStore() {
  await closeRedis();
}
