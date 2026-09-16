import { Router } from "express";

import {
  testGoogleDrive,
} from "../controllers/google-drive.controller.js";

const router = Router();

router.get(
  "/google-drive/test",
  testGoogleDrive,
);

export default router;