const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");

process.env.JWT_SECRET = "isolated-pin-reset-test-secret";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";
process.env.RATE_LIMIT_STORE = "memory";
process.env.API_RATE_LIMIT_MAX = "100";
process.env.AUTH_PIN_RESET_RATE_LIMIT_WINDOW_MS = "60000";
process.env.AUTH_PIN_RESET_RATE_LIMIT_MAX = "7";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.ADMIN_GOOGLE_EMAIL = "karl.ortega.2002.ko@gmail.com";
process.env.CORS_ORIGINS = "http://localhost:5173";

const prisma = require("../dist/database/prisma.js").default;
const app = require("../dist/app.js").default;

test("Google-verified PIN recovery is account-bound, one-time, and rate limited", async () => {
  const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
  const updates = [];

  prisma.user.update = async (input) => {
    updates.push(input);
    return input.data;
  };

  OAuth2Client.prototype.verifyIdToken = async function ({
    idToken,
    audience,
  }) {
    assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
    const payload = JSON.parse(Buffer.from(idToken, "base64url").toString());
    return {
      getPayload: () => payload,
    };
  };

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth/pin-reset`;
  const makeToken = (payload) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");
  const post = (url, body) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify(body),
    });

  try {
    const challengeResponse = await post(`${base}/challenge`, {});
    assert.equal(challengeResponse.status, 200);
    const challenge = await challengeResponse.json();
    assert.equal(typeof challenge.nonce, "string");
    assert.equal(challenge.expiresIn, 300);

    const validRequest = {
      nonce: challenge.nonce,
      credential: makeToken({
        email: "karl.ortega.2002.ko@gmail.com",
        email_verified: true,
        nonce: challenge.nonce,
      }),
      newPin: "12345678",
    };
    const resetResponse = await post(base, validRequest);

    assert.equal(resetResponse.status, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].where.id, "admin");
    assert.equal(
      await bcrypt.compare("12345678", updates[0].data.pinHash),
      true,
    );

    const replayResponse = await post(base, validRequest);
    assert.equal(replayResponse.status, 401);
    assert.equal((await replayResponse.json()).code, "INVALID_VERIFICATION");

    const secondChallengeResponse = await post(`${base}/challenge`, {});
    assert.equal(secondChallengeResponse.status, 200);
    const secondChallenge = await secondChallengeResponse.json();
    const unauthorizedResponse = await post(base, {
      nonce: secondChallenge.nonce,
      credential: makeToken({
        email: "someone-else@example.com",
        email_verified: true,
        nonce: secondChallenge.nonce,
      }),
      newPin: "87654321",
    });
    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(updates.length, 1);

    const thirdChallengeResponse = await post(`${base}/challenge`, {});
    assert.equal(thirdChallengeResponse.status, 200);
    const thirdChallenge = await thirdChallengeResponse.json();
    const unverifiedResponse = await post(base, {
      nonce: thirdChallenge.nonce,
      credential: makeToken({
        email: "karl.ortega.2002.ko@gmail.com",
        email_verified: false,
        nonce: thirdChallenge.nonce,
      }),
      newPin: "87654321",
    });
    assert.equal(unverifiedResponse.status, 401);
    assert.equal(updates.length, 1);

    const blockedChallenge = await post(`${base}/challenge`, {});
    assert.equal(blockedChallenge.status, 429);
    assert.equal((await blockedChallenge.json()).code, "RATE_LIMITED");
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
