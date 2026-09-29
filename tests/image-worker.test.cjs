const { test } = require("node:test");
const assert = require("node:assert/strict");

test("the existing image Worker serves every image prefix and keeps private paths blocked", async () => {
  const { default: worker } = await import("../cloudflare/images/worker.mjs");
  const accessed = [];
  const env = {
    IMAGES: {
      async get(key) {
        accessed.push(key);
        return {
          body: "image-bytes",
          httpEtag: '"test-etag"',
          writeHttpMetadata(headers) {
            headers.set("content-type", "image/png");
          },
        };
      },
    },
  };
  for (const prefix of ["blog", "projects", "certifications"]) {
    const response = await worker.fetch(
      new Request(`https://images.example/${prefix}/image.png`),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(await response.text(), "image-bytes");
  }
  const head = await worker.fetch(
    new Request("https://images.example/projects/image.png", { method: "HEAD" }),
    env,
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const count = accessed.length;
  for (const key of ["resumes/private.pdf", "other/file.png", "projects/..secret.png"]) {
    assert.equal(
      (await worker.fetch(new Request(`https://images.example/${key}`), env)).status,
      404,
    );
  }
  assert.equal(
    (await worker.fetch(
      new Request("https://images.example/blog/image.png", { method: "POST" }),
      env,
    )).status,
    405,
  );
  assert.equal(accessed.length, count);
});
