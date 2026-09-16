import { Router } from "express";

import upload from "../../../middleware/upload.middleware.js";

import {
  uploadBlogImage,
} from "../controllers/upload.controller.js";

import {
  requireAuth,
} from "../../../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/upload",
  requireAuth,
  upload.single("image"),
  uploadBlogImage,
);

export default router;