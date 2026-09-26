const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "isolated-rate-limit-test-secret";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";
process.env.RATE_LIMIT_STORE = "memory";
process.env.API_RATE_LIMIT_WINDOW_MS = "60000";
process.env.API_RATE_LIMIT_MAX = "7";
process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "1";
process.env.UPLOAD_RATE_LIMIT_WINDOW_MS = "60000";
process.env.UPLOAD_RATE_LIMIT_MAX = "1";

const prisma = require("../dist/database/prisma.js").default;
const app = require("../dist/app.js").default;

test("global and sensitive API limits return a JSON 429 response", async () => {
  prisma.user.findUnique = async () => null;

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const firstLogin = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "00000000" }),
    });
    assert.equal(firstLogin.status, 401);

    const blockedLogin = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "00000000" }),
    });
    assert.equal(blockedLogin.status, 429);
    assert.equal((await blockedLogin.json()).code, "RATE_LIMITED");
    assert.ok(blockedLogin.headers.get("retry-after"));

    const firstUpload = await fetch(`${base}/blog/upload`, { method: "POST" });
    assert.equal(firstUpload.status, 401);

    const blockedUpload = await fetch(`${base}/blog/upload`, {
      method: "POST",
    });
    assert.equal(blockedUpload.status, 429);
    assert.equal((await blockedUpload.json()).code, "RATE_LIMITED");

    for (let request = 0; request < 3; request += 1) {
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 200);
    }

    const blockedHealth = await fetch(`${base}/health`);
    assert.equal(blockedHealth.status, 429);
    assert.equal((await blockedHealth.json()).code, "RATE_LIMITED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
