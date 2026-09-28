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
    postGroups,
    projectGroups,
    experienceGroups,
    portfolioContentGroups,
    siteSettings,
  ] = await Promise.all([
    uniqueVisitorsSince(starts.day, now),
    uniqueVisitorsSince(starts.week, now),
    uniqueVisitorsSince(starts.month, now),
    prisma.blogPost.groupBy({
      by: ["published"],
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ["published"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.experience.groupBy({
      by: ["published"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.portfolioContent.groupBy({
      by: ["kind", "published"],
      _count: { _all: true },
    }),
    prisma.siteSettings.findUnique({
      where: { id: "site" },
      select: { isHired: true },
    }),
  ]);

  const countVisibility = (
    groups: { published: boolean; _count: { _all: number } }[],
  ) => {
    const published = groups
      .filter((group) => group.published)
      .reduce((total, group) => total + group._count._all, 0);
    const hidden = groups
      .filter((group) => !group.published)
      .reduce((total, group) => total + group._count._all, 0);
    return { total: published + hidden, published, hidden };
  };
  const postVisibility = countVisibility(postGroups);
  const projectVisibility = countVisibility(projectGroups);
  const experienceVisibility = countVisibility(experienceGroups);
  const portfolioContentVisibility = (kind: string) =>
    countVisibility(
      portfolioContentGroups
        .filter((group) => group.kind.toLowerCase() === kind)
        .map((group) => ({
          published: group.published,
          _count: group._count,
        })),
    );

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
    content: {
      posts: postVisibility.total,
      publishedPosts: postVisibility.published,
      draftPosts: postVisibility.hidden,
      projects: projectVisibility.total,
      publishedProjects: projectVisibility.published,
      hiddenProjects: projectVisibility.hidden,
      experience: experienceVisibility,
      stack: portfolioContentVisibility("stack"),
      skills: portfolioContentVisibility("skill"),
      certifications: portfolioContentVisibility("certification"),
      recommendations: portfolioContentVisibility("recommendation"),
    },
    settings: { isHired: siteSettings?.isHired ?? false },
    storage,
    onlineViewers: currentViewerCount(),
    retentionDays: 90,
    generatedAt: now.toISOString(),
  });
});

export default router;
