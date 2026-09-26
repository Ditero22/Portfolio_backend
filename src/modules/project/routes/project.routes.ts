import { Router } from "express";
import prisma from "../../../database/prisma.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";

const router = Router();
router.get("/projects", async (_req, res) =>
  res.json(
    await prisma.project.findMany({
      where: { published: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ),
);
router.get("/admin/projects", requireAuth, async (_req, res) =>
  res.json(
    await prisma.project.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ),
);
router.patch("/admin/projects/order", requireAuth, async (req, res) => {
  const ids: unknown = req.body?.ids;
  if (
    !Array.isArray(ids) ||
    !ids.every((id): id is string => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "Provide unique project IDs." });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const requested = new Set(ids);
    if (
      projects.length !== ids.length ||
      projects.some((project) => !requested.has(project.id))
    )
      return null;
    for (const [sortOrder, id] of ids.entries()) {
      await tx.project.update({ where: { id }, data: { sortOrder } });
    }
    return tx.project.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  });
  if (!result) {
    res
      .status(409)
      .json({
        message: "Projects changed. Refresh the page before reordering.",
      });
    return;
  }
  res.json(result);
});
router.post("/projects", requireAuth, async (req, res) =>
  res.status(201).json(await prisma.project.create({ data: req.body })),
);
router.patch("/projects/:id", requireAuth, async (req, res) =>
  res.json(
    await prisma.project.update({
      where: { id: String(req.params.id) },
      data: req.body,
    }),
  ),
);
router.delete("/projects/:id", requireAuth, async (req, res) => {
  await prisma.project.update({
    where: { id: String(req.params.id) },
    data: { deletedAt: new Date() },
  });
  res.status(204).end();
});
router.post("/projects/:id/restore", requireAuth, async (req, res) =>
  res.json(
    await prisma.project.update({
      where: { id: String(req.params.id) },
      data: { deletedAt: null },
    }),
  ),
);
router.delete("/projects/:id/permanent", requireAuth, async (req, res) => {
  await prisma.project.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});
export default router;
