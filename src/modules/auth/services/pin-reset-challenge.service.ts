import { randomBytes } from "node:crypto";

import { redisClient } from "../../../database/redis.js";

const challengeLifetimeSeconds = 5 * 60;
const challengePrefix = "portfolio:auth:pin-reset:challenge:";
const inMemoryChallenges = new Map<string, number>();

function pruneExpiredChallenges(now: number) {
  for (const [nonce, expiresAt] of inMemoryChallenges) {
    if (expiresAt <= now) inMemoryChallenges.delete(nonce);
  }
}

export async function createPinResetChallenge() {
  const nonce = randomBytes(32).toString("base64url");

  if (redisClient) {
    await redisClient.set(`${challengePrefix}${nonce}`, "1", {
      EX: challengeLifetimeSeconds,
      NX: true,
    });
  } else {
    const now = Date.now();
    pruneExpiredChallenges(now);
    inMemoryChallenges.set(nonce, now + challengeLifetimeSeconds * 1000);
  }

  return nonce;
}

export async function consumePinResetChallenge(nonce: string) {
  if (redisClient) {
    return (await redisClient.getDel(`${challengePrefix}${nonce}`)) === "1";
  }

  const now = Date.now();
  const expiresAt = inMemoryChallenges.get(nonce);
  inMemoryChallenges.delete(nonce);

  return expiresAt !== undefined && expiresAt > now;
}
