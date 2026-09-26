const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../dist/database/prisma.js").default;
const router =
  require("../dist/modules/portfolioContent/routes/portfolioContent.routes.js").default;

test("portfolio content stays private until published and can be managed by admin", async () => {
  process.env.JWT_SECRET = "isolated-content-test-secret";
  const entries = new Map();
  prisma.portfolioContent.findMany = async ({ where }) =>
    [...entries.values()].filter(
      (entry) =>
        (!where.kind || entry.kind === where.kind) &&
        (where.published === undefined || entry.published === where.published),
    );
  prisma.portfolioContent.aggregate = async () => ({
    _max: {
      sortOrder: Math.max(
        -1,
        ...[...entries.values()].map((entry) => entry.sortOrder),
      ),
    },
  });
  prisma.portfolioContent.create = async ({ data }) => {
    const entry = { id: "test-skill", ...data };
    entries.set(entry.id, entry);
    return entry;
  };
  prisma.portfolioContent.findFirst = async ({ where }) =>
    [...entries.values()].find(
      (entry) => entry.id === where.id && entry.kind === where.kind,
    ) ?? null;
  prisma.portfolioContent.update = async ({ where, data }) => {
    const entry = { ...entries.get(where.id), ...data };
    entries.set(entry.id, entry);
    return entry;
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

  try {
    assert.equal(
      (
        await fetch(`${base}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "React", published: true }),
        })
      ).status,
      401,
    );

    const created = await fetch(`${base}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "React",
        subtitle: "Comfortable",
        description: "Building interactive interfaces.",
        category: "Frontend",
        url: null,
        published: false,
      }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await (await fetch(`${base}/skills`)).json(), []);

    const adminEntries = await (
      await fetch(`${base}/admin/skills`, { headers })
    ).json();
    assert.equal(adminEntries.length, 1);
    assert.equal(adminEntries[0].category, "Frontend");

    const published = await fetch(`${base}/skills/test-skill`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ published: true }),
    });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).title, "React");
    const publicSkills = await (await fetch(`${base}/skills`)).json();
    assert.equal(publicSkills.length, 1);
    assert.equal(
      publicSkills[0].description,
      "Building interactive interfaces.",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
