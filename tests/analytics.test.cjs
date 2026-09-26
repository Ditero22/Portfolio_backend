const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "isolated-analytics-test-secret";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";

const prisma = require("../dist/database/prisma.js").default;
const router =
  require("../dist/modules/analytics/routes/analytics.routes.js").default;

test("visitor CSV exports respect date and page filters", async () => {
  const selectedDay = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const date = selectedDay.toISOString().slice(0, 10);
  const entries = [
    {
      visitedAt: new Date(`${date}T10:00:00.000Z`),
      visitorId: "visitor-blog",
      path: "/blog/first-post",
    },
    {
      visitedAt: new Date(`${date}T11:00:00.000Z`),
      visitorId: "visitor-blog-list",
      path: "/blog",
    },
    {
      visitedAt: new Date(`${date}T12:00:00.000Z`),
      visitorId: "visitor-projects",
      path: "/projects",
    },
    {
      visitedAt: new Date(`${date}T13:00:00.000Z`),
      visitorId: "visitor-near-match",
      path: "/blogger",
    },
  ];

  prisma.visitorLog.deleteMany = async () => ({ count: 0 });
  prisma.visitorLog.findMany = async ({ where }) => {
    const withinDates = entries.filter(
      (entry) =>
        entry.visitedAt >= where.visitedAt.gte &&
        entry.visitedAt <= where.visitedAt.lte,
    );
    const filtered = where.OR
      ? withinDates.filter((entry) =>
          where.OR.some((condition) =>
            typeof condition.path === "string"
              ? entry.path === condition.path
              : entry.path.startsWith(condition.path.startsWith),
          ),
        )
      : withinDates;
    return filtered.sort((a, b) => b.visitedAt - a.visitedAt);
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
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const response = await fetch(
      `${base}/admin/analytics/logs.csv?from=${date}&to=${date}&path=%2Fblog`,
      { headers },
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-disposition"),
      new RegExp(`${date}-to-${date}`),
    );
    const csv = await response.text();
    assert.match(csv, /visitor-blog/);
    assert.match(csv, /visitor-blog-list/);
    assert.doesNotMatch(csv, /visitor-projects/);
    assert.doesNotMatch(csv, /visitor-near-match/);

    const invalidRange = await fetch(
      `${base}/admin/analytics/logs.csv?from=not-a-date&to=${date}`,
      { headers },
    );
    assert.equal(invalidRange.status, 400);

    const expiredDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const expiredRange = await fetch(
      `${base}/admin/analytics/logs.csv?from=${expiredDate}&to=${expiredDate}`,
      { headers },
    );
    assert.equal(expiredRange.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
