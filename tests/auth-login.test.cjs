const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";
process.env.RATE_LIMIT_STORE = "memory";
process.env.API_RATE_LIMIT_MAX = "100";
process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "10";

const prisma = require("../dist/database/prisma.js").default;
const app = require("../dist/app.js").default;

test("admin login reports missing JWT configuration and handles valid and invalid PINs", async () => {
  const pinHash = await bcrypt.hash("12345678", 4);
  let databaseLookups = 0;
  prisma.user.findUnique = async () => {
    databaseLookups += 1;
    return { pinHash };
  };

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/auth/login";
  const postLogin = (pin) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

  try {
    const unconfiguredResponse = await postLogin("12345678");
    assert.equal(unconfiguredResponse.status, 503);
    assert.deepEqual(await unconfiguredResponse.json(), {
      code: "AUTH_NOT_CONFIGURED",
      message:
        "Admin sign-in is unavailable because the backend JWT_SECRET is not configured.",
    });
    assert.equal(databaseLookups, 0);

    const invalidShapeResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]",
    });
    assert.equal(invalidShapeResponse.status, 400);
    assert.deepEqual(await invalidShapeResponse.json(), {
      message: "PIN must be exactly 8 digits.",
    });
    assert.equal(databaseLookups, 0);

    process.env.JWT_SECRET = "isolated-auth-login-test-secret";
    const validResponse = await postLogin("12345678");
    assert.equal(validResponse.status, 200);
    const validBody = await validResponse.json();
    assert.equal(validBody.user.role, "admin");
    const tokenPayload = jwt.verify(
      validBody.accessToken,
      process.env.JWT_SECRET,
    );
    assert.equal(tokenPayload.userId, "admin");
    assert.equal(tokenPayload.role, "admin");

    const invalidResponse = await postLogin("87654321");
    assert.equal(invalidResponse.status, 401);
    assert.deepEqual(await invalidResponse.json(), { message: "Invalid PIN." });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
