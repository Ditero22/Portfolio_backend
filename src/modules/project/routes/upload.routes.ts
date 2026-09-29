import { Router } from "express";
import upload from "../../../middleware/upload.middleware.js";
import { requireAdmin } from "../../../middleware/auth.middleware.js";
import { validateUploadedImage } from "../../../middleware/validate-image.middleware.js";
import { uploadProjectImage } from "../controllers/upload.controller.js";

const router = Router();

router.post(
  "/upload",
  requireAdmin,
  upload.single("image"),
  validateUploadedImage,
  uploadProjectImage,
);

export default router;
