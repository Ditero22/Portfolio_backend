const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "production";
process.env.CORS_ORIGINS = "https://frontend.example.test";
process.env.TRUST_PROXY_HOPS = "1";
process.env.JWT_SECRET = "isolated-upload-routing-test-secret-at-least-32-chars";
process.env.RATE_LIMIT_STORE = "memory";
process.env.API_RATE_LIMIT_MAX = "100";
process.env.UPLOAD_RATE_LIMIT_MAX = "100";

const externalCalls = [];
const rejectExternalCall = (name) => {
  externalCalls.push(name);
  throw new Error(`Upload routing must not call ${name}.`);
};

// Keep the full app's routes and middleware, with external services offline.
const prismaPath = require.resolve("../dist/database/prisma.js");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    __esModule: true,
    default: new Proxy({}, {
      get: (_target, name) => rejectExternalCall(`database.${String(name)}`),
    }),
  },
};

const storagePath = require.resolve("../dist/modules/storage/r2-upload.service.js");
require.cache[storagePath] = {
  id: storagePath,
  filename: storagePath,
  loaded: true,
  exports: Object.fromEntries([
    "getR2StorageUsage",
    "uploadImageToR2",
    "uploadResumeToR2",
    "getR2ObjectData",
    "deleteR2Object",
  ].map((name) => [name, () => rejectExternalCall(`storage.${name}`)])),
};

const app = require("../dist/app.js").default;

test("the full app routes each authenticated image upload", { timeout: 10_000 }, async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign(
    { userId: "admin", role: "admin" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5h" },
  );

  for (const path of [
    "/api/projects/upload",
    "/api/blog/upload",
    "/api/certifications/upload",
  ]) {
    await t.test(`POST ${path} rejects an empty multipart upload`, async () => {
      const response = await fetch(base + path, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: new FormData(),
      });
      assert.equal(response.status, 400, `${path} must reach image upload middleware`);
      assert.deepEqual(await response.json(), {
        message: "Choose a JPG, PNG, WebP, or GIF image.",
      });
    });
  }

  assert.deepEqual(externalCalls, []);
});
