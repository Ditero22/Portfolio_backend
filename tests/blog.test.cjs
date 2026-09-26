const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../dist/database/prisma.js").default;
const router = require("../dist/modules/blog/routes/blog.routes.js").default;

test("draft privacy, authenticated admin reads, and publication round trip", async () => {
  process.env.JWT_SECRET = "isolated-test-secret";
  const posts = new Map();
  prisma.blogPost.findMany = async ({ where }) =>
    [...posts.values()].filter(
      (post) =>
        where.published === undefined || post.published === where.published,
    );
  prisma.blogPost.findUnique = async ({ where }) => posts.get(where.id) ?? null;
  prisma.blogPost.findFirst = async ({ where }) =>
    [...posts.values()].find(
      (post) => post.slug === where.slug && post.published === where.published,
    ) ?? null;
  prisma.blogPost.create = async ({ data }) => {
    const post = { id: "test-post", ...data };
    posts.set(post.id, post);
    return post;
  };
  prisma.blogPost.update = async ({ where, data }) => {
    const post = { ...posts.get(where.id), ...data };
    posts.set(where.id, post);
    return post;
  };
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign(
    { userId: "admin", role: "admin" },
    process.env.JWT_SECRET,
  );
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const content = JSON.stringify({
    format: "portfolio-blocks-v1",
    blocks: [
      { id: "text", type: "text", text: "Hello", alignment: "left" },
      {
        id: "image",
        type: "image",
        src: "https://example.com/photo.png",
        alt: "Photo",
        caption: "",
        alignment: "right",
        width: "small",
      },
    ],
  });
  try {
    const created = await fetch(`${base}/blog`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Draft",
        slug: "draft",
        excerpt: "Test",
        category: "Test",
        content,
        imageUrl: "https://example.com/cover.png",
        link: "https://example.com",
        published: false,
      }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await (await fetch(`${base}/blog`)).json(), []);
    assert.equal((await fetch(`${base}/blog/test-post`)).status, 404);
    assert.equal((await fetch(`${base}/blog/slug/draft`)).status, 404);
    assert.equal((await fetch(`${base}/admin/blog`)).status, 401);
    assert.equal((await fetch(`${base}/admin/blog/test-post`)).status, 401);
    assert.equal(
      (await (await fetch(`${base}/admin/blog`, { headers })).json()).length,
      1,
    );
    assert.equal(
      (await (await fetch(`${base}/admin/blog/test-post`, { headers })).json())
        .content,
      content,
    );
    const published = await (
      await fetch(`${base}/blog/test-post`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ published: true }),
      })
    ).json();
    assert.equal(published.imageUrl, "https://example.com/cover.png");
    assert.equal(published.link, "https://example.com");
    assert.equal((await (await fetch(`${base}/blog`)).json()).length, 1);
    const publicPost = await (await fetch(`${base}/blog/slug/draft`)).json();
    assert.equal(publicPost.content, content);
    assert.equal((await fetch(`${base}/blog/test-post`)).status, 200);
    await fetch(`${base}/blog/test-post`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ published: false }),
    });
    assert.equal((await fetch(`${base}/blog/slug/draft`)).status, 404);
    assert.deepEqual(await (await fetch(`${base}/blog`)).json(), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
