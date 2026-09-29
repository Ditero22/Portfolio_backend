const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { networkInterfaces } = require("node:os");
const path = require("node:path");

process.env.NODE_ENV = "development";
process.env.CORS_ORIGINS = "https://configured.example.test";
process.env.DEV_FRONTEND_PORT = "5173";
const { resolveExpressApp } = require("../dist/runtime/express-app.js");
const { getAllowedBrowserOrigins, isConfiguredOriginAllowed } = require("../dist/security/origins.js");

test("Express imports work with both tsx and compiled CommonJS export shapes", () => {
  const app = Object.assign(() => {}, { listen() {} });
  assert.equal(resolveExpressApp({ default: app }), app);
  assert.equal(resolveExpressApp({ default: { default: app } }), app);
  assert.throws(() => resolveExpressApp({ default: {} }), /Express application/);
});

test("development permits this computer's frontend origins while production stays explicit", () => {
  const origins = getAllowedBrowserOrigins();
  assert.ok(origins.includes("http://localhost:5173"));
  assert.ok(origins.includes("http://127.0.0.1:5173"));
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        assert.ok(origins.includes(`http://${address.address}:5173`));
      }
    }
  }
  assert.equal(isConfiguredOriginAllowed("https://untrusted.example.test"), false);
  process.env.NODE_ENV = "production";
  try {
    assert.deepEqual(getAllowedBrowserOrigins(), ["https://configured.example.test"]);
    assert.equal(isConfiguredOriginAllowed("http://localhost:5173"), false);
  } finally {
    process.env.NODE_ENV = "development";
  }
});

test("the real compiled server entrypoint starts and serves health", { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "0",
      TRUST_PROXY_HOPS: "1",
      CORS_ORIGINS: "https://frontend.example.test",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test?connect_timeout=1",
      JWT_SECRET: "startup-test-secret-at-least-thirty-two-characters",
      R2_ACCOUNT_ID: "test-account",
      R2_ACCESS_KEY_ID: "test-access-key",
      R2_SECRET_ACCESS_KEY: "test-secret-key",
      R2_BUCKET_NAME: "test-bucket",
      R2_PUBLIC_URL: "https://storage.example.test",
      RATE_LIMIT_STORE: "memory",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const timer = setTimeout(() => child.kill(), 12000);
  try {
    const port = await new Promise((resolve, reject) => {
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
      child.stderr.on("data", (data) => { output += data; });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Server exited before readiness (${code}): ${output}`)));
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  } finally {
    clearTimeout(timer);
    child.kill();
  }
});
