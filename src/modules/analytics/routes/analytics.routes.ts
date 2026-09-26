import { Router, type Response } from "express";
import prisma from "../../../database/prisma.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { getR2StorageUsage } from "../../storage/r2-upload.service.js";

const router = Router();
const retentionMs = 90 * 24 * 60 * 60 * 1000;
const liveStreams = new Map<Response, string>();

export async function purgeExpiredVisitorLogs(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionMs);
  await prisma.visitorLog.deleteMany({ where: { visitedAt: { lt: cutoff } } });
}

function currentViewerCount() {
  return new Set(liveStreams.values()).size;
}

function publishViewerCount() {
  const data = `data: ${JSON.stringify({ viewers: currentViewerCount() })}\n\n`;
  for (const stream of liveStreams.keys()) stream.write(data);
}

function rangeStarts(now: Date) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const week = new Date(day);
  week.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { day, week, month };
}

async function uniqueVisitorsSince(since: Date, now: Date) {
  const visitors = await prisma.visitorLog.findMany({
    where: { visitedAt: { gte: since, lte: now } },
    distinct: ["visitorId"],
    select: { visitorId: true },
  });
  return visitors.length;
}

router.get("/analytics/presence", (req, res) => {
  const visitorId = String(req.query.visitorId ?? "");
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(visitorId)) {
    res.status(400).end();
    return;
  }

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  liveStreams.set(res, visitorId);
  res.write(`data: ${JSON.stringify({ viewers: currentViewerCount() })}\n\n`);
  publishViewerCount();

  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25_000);
  heartbeat.unref();
  res.on("close", () => {
    clearInterval(heartbeat);
    liveStreams.delete(res);
    publishViewerCount();
  });
});

router.post("/analytics/visit", async (req, res) => {
  const visitorId: unknown = req.body?.visitorId;
  const path: unknown = req.body?.path;
  if (
    typeof visitorId !== "string" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(visitorId) ||
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.length > 240
  ) {
    res.status(400).json({ message: "Invalid visit details." });
    return;
  }
  await prisma.visitorLog.create({
    data: { visitorId, path, visitedAt: new Date() },
  });
  res.status(202).end();
});

router.get("/admin/analytics", requireAuth, async (_req, res) => {
  const now = new Date();
  const starts = rangeStarts(now);
  const [
    today,
    thisWeek,
    thisMonth,
    postCount,
    publishedPosts,
    draftPosts,
    projects,
  ] = await Promise.all([
    uniqueVisitorsSince(starts.day, now),
    uniqueVisitorsSince(starts.week, now),
    uniqueVisitorsSince(starts.month, now),
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { published: true } }),
    prisma.blogPost.count({ where: { published: false } }),
    prisma.project.count({ where: { deletedAt: null } }),
  ]);

  let storage: {
    available: boolean;
    bytes: number | null;
    objects: number | null;
  };
  try {
    const usage = await getR2StorageUsage();
    storage = usage
      ? { available: true, bytes: usage.bytes, objects: usage.objects }
      : { available: false, bytes: null, objects: null };
  } catch {
    storage = { available: false, bytes: null, objects: null };
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({
    visitors: { today, thisWeek, thisMonth },
    content: { posts: postCount, publishedPosts, draftPosts, projects },
    storage,
    onlineViewers: currentViewerCount(),
    retentionDays: 90,
    generatedAt: now.toISOString(),
  });
});

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

router.get("/admin/analytics/logs.csv", requireAuth, async (req, res) => {
  const now = new Date();
  const retentionStart = new Date(now.getTime() - retentionMs);
  const earliestDate = retentionStart.toISOString().slice(0, 10);
  const latestDate = now.toISOString().slice(0, 10);
  const from =
    typeof req.query.from === "string" ? req.query.from : earliestDate;
  const to = typeof req.query.to === "string" ? req.query.to : latestDate;
  const path = typeof req.query.path === "string" ? req.query.path : "";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);
  const fromIsValid =
    datePattern.test(from) && fromDate.toISOString().slice(0, 10) === from;
  const toIsValid =
    datePattern.test(to) && toDate.toISOString().slice(0, 10) === to;

  if (
    !fromIsValid ||
    !toIsValid ||
    fromDate > toDate ||
    (path && (!path.startsWith("/") || path.length > 240))
  ) {
    res
      .status(400)
      .json({ message: "Choose a valid date range and page filter." });
    return;
  }
  if (toDate < retentionStart) {
    res.status(400).json({ message: "Visitor logs are retained for 90 days." });
    return;
  }

  const since = fromDate < retentionStart ? retentionStart : fromDate;
  const until = toDate > now ? now : toDate;
  const logs = await prisma.visitorLog.findMany({
    where: {
      visitedAt: { gte: since, lte: until },
      ...(path && {
        OR:
          path === "/"
            ? [{ path }]
            : [{ path }, { path: { startsWith: `${path}/` } }],
      }),
    },
    orderBy: { visitedAt: "desc" },
    select: { visitedAt: true, visitorId: true, path: true },
  });
  const lines = [
    "visited_at,visitor_id,path",
    ...logs.map((log) =>
      [log.visitedAt.toISOString(), log.visitorId, log.path]
        .map(csvCell)
        .join(","),
    ),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="portfolio-visitor-logs-${from}-to-${to}.csv"`,
  );
  res.send(lines.join("\r\n"));
});

export default router;
