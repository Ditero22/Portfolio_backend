const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

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
