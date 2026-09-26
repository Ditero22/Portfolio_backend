import { Router } from "express";
import {
  createPinResetChallengeHandler,
  login,
  resetAdminPin,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", login);
router.post("/pin-reset/challenge", createPinResetChallengeHandler);
router.post("/pin-reset", resetAdminPin);

export default router;
