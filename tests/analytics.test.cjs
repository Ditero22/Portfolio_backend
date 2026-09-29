const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

const prisma = require("../dist/database/prisma.js").default;
const analytics = require("../dist/modules/analytics/routes/analytics.routes.js");

test("visitor logs still expire after 90 days and CSV export is removed", async () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  let cleanupFilter;
  prisma.visitorLog.deleteMany = async ({ where }) => {
    cleanupFilter = where;
    return { count: 0 };
  };

  await analytics.purgeExpiredVisitorLogs(now);
  assert.equal(
    cleanupFilter.visitedAt.lt.toISOString(),
    "2026-06-30T12:00:00.000Z",
  );

  const app = express();
  app.use("/api", analytics.default);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/admin/analytics/logs.csv`,
    );
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});

test("admin analytics summarizes every managed content feature", async () => {
  process.env.JWT_SECRET = "analytics-test-secret";
  prisma.visitorLog.findMany = async () => [];
  prisma.blogPost.groupBy = async () => [
    { published: true, _count: { _all: 3 } },
    { published: false, _count: { _all: 2 } },
  ];
  prisma.project.groupBy = async () => [
    { published: true, _count: { _all: 4 } },
    { published: false, _count: { _all: 1 } },
  ];
  prisma.experience.groupBy = async () => [
    { published: true, _count: { _all: 2 } },
  ];
  prisma.portfolioContent.groupBy = async () => [
    { kind: "STACK", published: true, _count: { _all: 5 } },
    { kind: "STACK", published: false, _count: { _all: 1 } },
    { kind: "SKILL", published: true, _count: { _all: 7 } },
    { kind: "CERTIFICATION", published: false, _count: { _all: 2 } },
    { kind: "RECOMMENDATION", published: true, _count: { _all: 3 } },
    { kind: "RESOURCE", published: true, _count: { _all: 8 } },
    { kind: "RESOURCE", published: false, _count: { _all: 1 } },
  ];
  prisma.siteSettings.findUnique = async () => ({ isHired: true });

  const app = express();
  app.use("/api", analytics.default);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const token = jwt.sign(
    { userId: "admin", role: "admin" },
    process.env.JWT_SECRET,
  );

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/admin/analytics`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.content, {
      posts: 5,
      publishedPosts: 3,
      draftPosts: 2,
      projects: 5,
      publishedProjects: 4,
      hiddenProjects: 1,
      experience: { total: 2, published: 2, hidden: 0 },
      stack: { total: 6, published: 5, hidden: 1 },
      skills: { total: 7, published: 7, hidden: 0 },
      certifications: { total: 2, published: 0, hidden: 2 },
      recommendations: { total: 3, published: 3, hidden: 0 },
      resources: { total: 9, published: 8, hidden: 1 },
    });
    assert.deepEqual(body.settings, { isHired: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
