import { Router } from "express";
import upload from "../../../middleware/upload.middleware.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { uploadProjectImage } from "../controllers/upload.controller.js";

const router = Router();

router.post("/upload", requireAuth, upload.single("image"), uploadProjectImage);

export default router;
