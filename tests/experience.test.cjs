const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../dist/database/prisma.js").default;
const router =
  require("../dist/modules/experience/routes/experience.routes.js").default;

test("experience validation, privacy, order, and deletion", async () => {
  process.env.JWT_SECRET = "isolated-experience-test-secret";
  const records = new Map();
  const matches = (item, where = {}) =>
    Object.entries(where).every(([key, value]) => item[key] === value);
  prisma.experience.findMany = async ({ where, select }) =>
    [...records.values()]
      .filter((item) => matches(item, where))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => (select ? { id: item.id } : { ...item }));
  prisma.experience.findFirst = async ({ where }) =>
    [...records.values()].find((item) => matches(item, where)) ?? null;
  prisma.experience.aggregate = async () => ({
    _max: {
      sortOrder: records.size
        ? Math.max(...[...records.values()].map((item) => item.sortOrder))
        : null,
    },
  });
  prisma.experience.create = async ({ data }) => {
    const item = { id: String(records.size + 1), deletedAt: null, ...data };
    records.set(item.id, item);
    return item;
  };
  prisma.experience.update = async ({ where, data }) => {
    const item = { ...records.get(where.id), ...data };
    records.set(where.id, item);
    return item;
  };
  prisma.experience.updateMany = async ({ where, data }) => {
    const found = [...records.values()].filter((item) => matches(item, where));
    found.forEach((item) => records.set(item.id, { ...item, ...data }));
    return { count: found.length };
  };
  prisma.$transaction = async (callback) => callback(prisma);
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: "admin", role: "admin" }, process.env.JWT_SECRET)}`,
  };
  const send = (path, method, body) =>
    fetch(base + path, { method, headers, body: JSON.stringify(body) });
  const details = {
    company: "Test company",
    role: "Developer",
    location: "Remote",
    startDate: "2025-01",
    endDate: null,
    description: "Test only",
    highlights: ["Delivered work"],
    published: false,
  };
  try {
    assert.equal((await fetch(base + "/admin/experience")).status, 401);
    assert.equal(
      (
        await fetch(base + "/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        })
      ).status,
      401,
    );
    assert.equal(
      (await send("/experience", "POST", { ...details, endDate: "2024-12" }))
        .status,
      400,
    );
    assert.equal(
      (await send("/experience", "POST", { ...details, startDate: "2025-13" }))
        .status,
      400,
    );
    assert.equal(
      (await send("/experience", "POST", { ...details, company: "x".repeat(201) }))
        .status,
      400,
    );
    assert.equal(
      (
        await send("/experience", "POST", {
          ...details,
          highlights: Array.from({ length: 41 }, (_, index) => `Highlight ${index}`),
        })
      ).status,
      400,
    );
    assert.equal((await send("/experience", "POST", details)).status, 201);
    assert.deepEqual(await (await fetch(base + "/experience")).json(), []);
    assert.equal(
      (await send("/experience/1", "PATCH", { published: true })).status,
      200,
    );
    assert.equal((await (await fetch(base + "/experience")).json()).length, 1);
    await send("/experience", "POST", {
      ...details,
      company: "Second",
      published: true,
    });
    assert.equal(
      (await send("/admin/experience/order", "PATCH", { ids: ["1", "1"] }))
        .status,
      400,
    );
    assert.equal(
      (await send("/admin/experience/order", "PATCH", { ids: ["1"] })).status,
      409,
    );
    assert.equal(
      (await send("/admin/experience/order", "PATCH", { ids: ["2", "1"] }))
        .status,
      200,
    );
    assert.deepEqual(
      (await (await fetch(base + "/experience")).json()).map((item) => item.id),
      ["2", "1"],
    );
    await send("/experience/1", "PATCH", { published: false });
    assert.deepEqual(
      (await (await fetch(base + "/experience")).json()).map((item) => item.id),
      ["2"],
    );
    assert.equal((await send("/experience/2", "DELETE")).status, 204);
    assert.deepEqual(await (await fetch(base + "/experience")).json(), []);
    assert.equal(
      (await send("/experience/2", "PATCH", { published: true })).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
