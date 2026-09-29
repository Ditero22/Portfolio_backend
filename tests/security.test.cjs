const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "security-regression-test-secret-at-least-32-chars";
process.env.NODE_ENV = "production";
process.env.CORS_ORIGINS = "https://portfolio.example.test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";
process.env.RATE_LIMIT_STORE = "memory";

const app = require("../dist/app.js").default;
const { validateProductionEnvironment } = require("../dist/security/origins.js");
const { logServerError } = require("../dist/security/safe-log.js");

test("admin identity, token age, CORS, and security headers are enforced", async () => {
  assert.equal(app.get("trust proxy"), 1);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const secret = process.env.JWT_SECRET;
  const signed = (claims, algorithm = "HS256") =>
    jwt.sign(claims, secret, { algorithm });

  try {
    assert.equal((await fetch(`${base}/api/admin/test`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/api/admin/test`, {
          headers: {
            Authorization: `Bearer ${signed({ userId: "viewer", role: "admin" })}`,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/admin/test`, {
          headers: {
            Authorization: `Bearer ${signed({ userId: "admin", role: "viewer" })}`,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/admin/test`, {
          headers: {
            Authorization: `Bearer ${signed({ userId: "admin", role: "admin" }, "HS384")}`,
          },
        })
      ).status,
      401,
    );

    const oldIssuedAt = Math.floor(Date.now() / 1000) - 6 * 60 * 60;
    const oldToken = signed({
      userId: "admin",
      role: "admin",
      iat: oldIssuedAt,
    });
    assert.equal(
      (
        await fetch(`${base}/api/admin/test`, {
          headers: { Authorization: `Bearer ${oldToken}` },
        })
      ).status,
      401,
    );

    const trusted = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://portfolio.example.test" },
    });
    assert.equal(
      trusted.headers.get("access-control-allow-origin"),
      "https://portfolio.example.test",
    );
    assert.equal(trusted.headers.get("x-content-type-options"), "nosniff");
    assert.equal(trusted.headers.get("x-frame-options"), "DENY");
    assert.match(
      trusted.headers.get("strict-transport-security"),
      /max-age=31536000/,
    );
    assert.match(
      trusted.headers.get("content-security-policy"),
      /default-src 'self'/,
    );

    const untrusted = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert.equal(untrusted.headers.get("access-control-allow-origin"), null);

    const malformedJson = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformedJson.status, 400);
    const oversizedJson = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(101 * 1024) }),
    });
    assert.equal(oversizedJson.status, 413);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("login rate limiting returns 429 after the configured failed-attempt limit", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Forwarded-For": "198.51.100.42",
  };

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ pin: "1" }),
      });
      assert.equal(response.status, 400);
    }

    const limited = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pin: "1" }),
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, "RATE_LIMITED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("production configuration rejects weak JWT secrets", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  const originalProxyHops = process.env.TRUST_PROXY_HOPS;
  process.env.NODE_ENV = "production";
  process.env.TRUST_PROXY_HOPS = "1";
  try {
    assert.doesNotThrow(validateProductionEnvironment);
    process.env.JWT_SECRET = "short";
    assert.throws(validateProductionEnvironment, /JWT_SECRET must contain/);
    process.env.JWT_SECRET = originalSecret;
    process.env.TRUST_PROXY_HOPS = "0";
    assert.throws(validateProductionEnvironment, /TRUST_PROXY_HOPS must be at least 1/);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
    if (originalProxyHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalProxyHops;
  }
});

test("server error logs omit untrusted error messages", () => {
  const calls = [];
  const originalError = console.error;
  console.error = (...args) => calls.push(args);
  try {
    logServerError(
      "Test failure.",
      new Error("postgresql://db-user:private-password@host/db"),
    );
  } finally {
    console.error = originalError;
  }
  assert.doesNotMatch(JSON.stringify(calls), /private-password|db-user/);
  assert.match(JSON.stringify(calls), /Test failure/);
});
