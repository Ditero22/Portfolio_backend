import { Router } from "express";
import prisma from "../../../database/prisma.js";
import { requireAdmin } from "../../../middleware/auth.middleware.js";

const router = Router();
const orderBy = [{ sortOrder: "asc" as const }, { id: "asc" as const }];
const month = /^\d{4}-(0[1-9]|1[0-2])$/;
const experienceLimits = {
  company: 200,
  role: 200,
  description: 6_000,
  location: 200,
  highlights: 40,
  highlight: 500,
} as const;
function parseInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (
    !["company", "role", "description", "startDate"].every(
      (key) => typeof data[key] === "string" && (data[key] as string).trim(),
    )
  )
    return null;
  if (
    typeof data.location !== "string" ||
    data.location.length > experienceLimits.location ||
    typeof data.published !== "boolean" ||
    !Array.isArray(data.highlights) ||
    data.highlights.length > experienceLimits.highlights ||
    !data.highlights.every(
      (value) =>
        typeof value === "string" &&
        value.trim().length <= experienceLimits.highlight,
    )
  )
    return null;
  if (
    (data.company as string).trim().length > experienceLimits.company ||
    (data.role as string).trim().length > experienceLimits.role ||
    (data.description as string).trim().length > experienceLimits.description
  )
    return null;
  const startDate = data.startDate as string;
  const endDate = data.endDate;
  if (
    !month.test(startDate) ||
    !(
      endDate === null ||
      (typeof endDate === "string" &&
        month.test(endDate) &&
        endDate >= startDate)
    )
  )
    return null;
  return {
    company: (data.company as string).trim(),
    role: (data.role as string).trim(),
    description: (data.description as string).trim(),
    location: data.location.trim(),
    startDate,
    endDate,
    highlights: data.highlights.map((value) => value.trim()).filter(Boolean),
    published: data.published,
  };
}
router.get("/experience", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(
    await prisma.experience.findMany({
      where: { published: true, deletedAt: null },
      orderBy,
    }),
  );
});
router.get("/admin/experience", requireAdmin, async (_req, res) =>
  res.json(
    await prisma.experience.findMany({ where: { deletedAt: null }, orderBy }),
  ),
);
router.patch("/admin/experience/order", requireAdmin, async (req, res) => {
  const ids: unknown = req.body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length > 500 ||
    !ids.every((id): id is string => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "Provide unique experience IDs." });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const entries = await tx.experience.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (
      entries.length !== ids.length ||
      entries.some((item) => !ids.includes(item.id))
    )
      return null;
    for (const [sortOrder, id] of ids.entries())
      await tx.experience.update({ where: { id }, data: { sortOrder } });
    return tx.experience.findMany({ where: { deletedAt: null }, orderBy });
  });
  if (!result) {
    res
      .status(409)
      .json({ message: "Experience changed. Refresh before reordering." });
    return;
  }
  res.json(result);
});
router.post("/experience", requireAdmin, async (req, res) => {
  const data = parseInput(req.body);
  if (!data) {
    res
      .status(400)
      .json({ message: "Enter valid experience details and dates." });
    return;
  }
  const last = await prisma.experience.aggregate({ _max: { sortOrder: true } });
  res
    .status(201)
    .json(
      await prisma.experience.create({
        data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      }),
    );
});
router.patch("/experience/:id", requireAdmin, async (req, res) => {
  const existing = await prisma.experience.findFirst({
    where: { id: String(req.params.id), deletedAt: null },
  });
  if (!existing) {
    res.status(404).json({ message: "Experience not found." });
    return;
  }
  const data = parseInput({ ...existing, ...req.body });
  if (!data) {
    res
      .status(400)
      .json({ message: "Enter valid experience details and dates." });
    return;
  }
  res.json(
    await prisma.experience.update({ where: { id: existing.id }, data }),
  );
});
router.delete("/experience/:id", requireAdmin, async (req, res) => {
  const result = await prisma.experience.updateMany({
    where: { id: String(req.params.id), deletedAt: null },
    data: { deletedAt: new Date() },
  });
  res.status(result.count ? 204 : 404).end();
});
export default router;
