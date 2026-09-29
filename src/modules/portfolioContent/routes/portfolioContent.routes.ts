import { Router } from "express";
import type { PortfolioContentType } from "@prisma/client";
import prisma from "../../../database/prisma.js";
import { requireAdmin } from "../../../middleware/auth.middleware.js";
import upload from "../../../middleware/upload.middleware.js";
import { validateUploadedImage } from "../../../middleware/validate-image.middleware.js";
import { uploadCertificationImage } from "../controllers/upload.controller.js";

const router = Router();

const kinds: Record<string, PortfolioContentType> = {
  stack: "STACK",
  certifications: "CERTIFICATION",
  recommendations: "RECOMMENDATION",
  skills: "SKILL",
  resources: "RESOURCE",
};

const orderBy = [{ sortOrder: "asc" as const }, { id: "asc" as const }];

router.post(
  "/certifications/upload",
  requireAdmin,
  upload.single("image"),
  validateUploadedImage,
  uploadCertificationImage,
);

function kindFor(value: string): PortfolioContentType | null {
  return kinds[value] ?? null;
}

function parseContent(
  body: unknown,
  fallback?: Record<string, unknown>,
  requireUrl = false,
  allowImage = false,
) {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const value = (key: string) =>
    input[key] !== undefined ? input[key] : (fallback?.[key] ?? null);
  const title = value("title");
  const subtitle = value("subtitle");
  const description = value("description");
  const category = value("category");
  const url = value("url");
  const imageUrl = value("imageUrl");
  const published = value("published");

  if (typeof title !== "string" || !title.trim() || title.length > 160)
    return null;
  if (
    subtitle !== null &&
    (typeof subtitle !== "string" || subtitle.length > 160)
  )
    return null;
  if (
    description !== null &&
    (typeof description !== "string" || description.length > 4000)
  )
    return null;
  if (
    category !== null &&
    (typeof category !== "string" || category.length > 80)
  )
    return null;
  if (url !== null && (typeof url !== "string" || url.length > 2048))
    return null;
  if (
    imageUrl !== null &&
    (typeof imageUrl !== "string" || imageUrl.length > 2048)
  )
    return null;
  if (!allowImage && imageUrl) return null;
  if (requireUrl && (typeof url !== "string" || !url.trim())) return null;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return null;
    } catch {
      return null;
    }
  }
  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return null;
    } catch {
      return null;
    }
  }
  if (typeof published !== "boolean") return null;

  return {
    title: title.trim(),
    subtitle: typeof subtitle === "string" ? subtitle.trim() || null : null,
    description:
      typeof description === "string" ? description.trim() || null : null,
    category: typeof category === "string" ? category.trim() || null : null,
    url: typeof url === "string" ? url.trim() || null : null,
    imageUrl: typeof imageUrl === "string" ? imageUrl.trim() || null : null,
    published,
  };
}

router.get("/:kind", async (req, res) => {
  const kind = kindFor(String(req.params.kind));
  if (!kind) {
    res.status(404).json({ message: "Portfolio section not found." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(
    await prisma.portfolioContent.findMany({
      where: { kind, published: true },
      orderBy,
    }),
  );
});

router.get("/admin/:kind", requireAdmin, async (req, res, next) => {
  const kind = kindFor(String(req.params.kind));
  if (!kind) {
    next();
    return;
  }
  res.json(
    await prisma.portfolioContent.findMany({ where: { kind }, orderBy }),
  );
});

router.patch("/admin/:kind/order", requireAdmin, async (req, res) => {
  const kind = kindFor(String(req.params.kind));
  const ids: unknown = req.body?.ids;
  if (
    !kind ||
    !Array.isArray(ids) ||
    ids.length > 500 ||
    !ids.every((id): id is string => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "Provide unique content IDs." });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const entries = await tx.portfolioContent.findMany({
      where: { kind },
      select: { id: true },
    });
    if (
      entries.length !== ids.length ||
      entries.some((entry) => !ids.includes(entry.id))
    )
      return null;
    for (const [sortOrder, id] of ids.entries()) {
      await tx.portfolioContent.update({ where: { id }, data: { sortOrder } });
    }
    return tx.portfolioContent.findMany({ where: { kind }, orderBy });
  });
  if (!result) {
    res
      .status(409)
      .json({ message: "Content changed. Refresh before reordering." });
    return;
  }
  res.json(result);
});

router.post("/:kind", requireAdmin, async (req, res) => {
  const kind = kindFor(String(req.params.kind));
  const data = parseContent(
    req.body,
    undefined,
    kind === "RESOURCE",
    kind === "CERTIFICATION",
  );
  if (!kind || !data) {
    res.status(400).json({ message: "Enter valid portfolio content." });
    return;
  }
  const last = await prisma.portfolioContent.aggregate({
    where: { kind },
    _max: { sortOrder: true },
  });
  res.status(201).json(
    await prisma.portfolioContent.create({
      data: { ...data, kind, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    }),
  );
});

router.patch("/:kind/:id", requireAdmin, async (req, res) => {
  const kind = kindFor(String(req.params.kind));
  if (!kind) {
    res.status(404).json({ message: "Portfolio section not found." });
    return;
  }
  const existing = await prisma.portfolioContent.findFirst({
    where: { id: String(req.params.id), kind },
  });
  if (!existing) {
    res.status(404).json({ message: "Portfolio item not found." });
    return;
  }
  const data = parseContent(
    req.body,
    existing,
    kind === "RESOURCE",
    kind === "CERTIFICATION",
  );
  if (!data) {
    res.status(400).json({ message: "Enter valid portfolio content." });
    return;
  }
  res.json(
    await prisma.portfolioContent.update({ where: { id: existing.id }, data }),
  );
});

router.delete("/:kind/:id", requireAdmin, async (req, res) => {
  const kind = kindFor(String(req.params.kind));
  if (!kind) {
    res.status(404).json({ message: "Portfolio section not found." });
    return;
  }
  const result = await prisma.portfolioContent.deleteMany({
    where: { id: String(req.params.id), kind },
  });
  res.status(result.count ? 204 : 404).end();
});

export default router;
