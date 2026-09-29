import { Router } from "express";

import upload from "../../../middleware/upload.middleware.js";

import { uploadBlogImage } from "../controllers/upload.controller.js";

import { requireAdmin } from "../../../middleware/auth.middleware.js";
import { validateUploadedImage } from "../../../middleware/validate-image.middleware.js";

const router = Router();

router.post(
  "/upload",
  requireAdmin,
  upload.single("image"),
  validateUploadedImage,
  uploadBlogImage,
);

export default router;
