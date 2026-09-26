import { Router } from "express";
import prisma from "../../../database/prisma.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";

const router = Router();

router.get("/settings/hiring", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "site" },
  });
  res.json({ isHired: settings?.isHired ?? false });
});

router.patch("/admin/settings/hiring", requireAuth, async (req, res) => {
  if (typeof req.body?.isHired !== "boolean") {
    res
      .status(400)
      .json({ message: "Choose whether you are currently hired." });
    return;
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: "site" },
    create: { id: "site", isHired: req.body.isHired },
    update: { isHired: req.body.isHired },
  });
  res.json({ isHired: settings.isHired });
});

export default router;
