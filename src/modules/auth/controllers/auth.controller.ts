import type { Request, Response } from "express";
import {
  createAccessToken,
  replaceAdminPin,
  verifyAdminPin,
  verifyGoogleAdminIdentity,
} from "../services/auth.service.js";
import {
  consumePinResetChallenge,
  createPinResetChallenge,
} from "../services/pin-reset-challenge.service.js";
import { isConfiguredOriginAllowed } from "../../../security/origins.js";

function hasAllowedBrowserOrigin(req: Request) {
  return isConfiguredOriginAllowed(req.get("origin"));
}

export async function login(req: Request, res: Response) {
  const body = req.body;
  const pin =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? body.pin
      : undefined;

  if (typeof pin !== "string" || !/^\d{8}$/.test(pin)) {
    return res.status(400).json({
      message: "PIN must be exactly 8 digits.",
    });
  }

  if (!process.env.JWT_SECRET?.trim()) {
    return res.status(503).json({
      code: "AUTH_NOT_CONFIGURED",
      message:
        "Admin sign-in is unavailable because the backend JWT_SECRET is not configured.",
    });
  }

  const valid = await verifyAdminPin(pin);

  if (!valid) {
    return res.status(401).json({
      message: "Invalid PIN.",
    });
  }

  const accessToken = createAccessToken();

  return res.json({
    accessToken,
    user: {
      role: "admin",
    },
  });
}

export async function createPinResetChallengeHandler(
  req: Request,
  res: Response,
) {
  if (!hasAllowedBrowserOrigin(req)) {
    return res.status(403).json({
      code: "ORIGIN_NOT_ALLOWED",
      message: "PIN recovery must be started from the portfolio site.",
    });
  }

  if (
    !process.env.GOOGLE_CLIENT_ID?.trim() ||
    !process.env.ADMIN_GOOGLE_EMAIL?.trim()
  ) {
    return res.status(503).json({
      code: "GOOGLE_VERIFICATION_NOT_CONFIGURED",
      message: "Google verification is not configured for PIN recovery.",
    });
  }

  const nonce = await createPinResetChallenge();

  return res.json({ nonce, expiresIn: 300 });
}

export async function resetAdminPin(req: Request, res: Response) {
  if (!hasAllowedBrowserOrigin(req)) {
    return res.status(403).json({
      code: "ORIGIN_NOT_ALLOWED",
      message: "PIN recovery must be completed from the portfolio site.",
    });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      code: "INVALID_REQUEST",
      message: "A JSON request body is required.",
    });
  }

  const { credential, newPin, nonce } = body;

  if (typeof newPin !== "string" || !/^\d{8}$/.test(newPin)) {
    return res.status(400).json({
      code: "INVALID_PIN",
      message: "PIN must be exactly 8 digits.",
    });
  }

  if (
    typeof nonce !== "string" ||
    nonce.length > 128 ||
    typeof credential !== "string" ||
    credential.length > 8192
  ) {
    return res.status(400).json({
      code: "INVALID_VERIFICATION",
      message: "Google verification could not be completed. Please try again.",
    });
  }

  const challengeIsValid = await consumePinResetChallenge(nonce);
  if (!challengeIsValid) {
    return res.status(401).json({
      code: "INVALID_VERIFICATION",
      message: "Google verification expired. Please try again.",
    });
  }

  const identityIsValid = await verifyGoogleAdminIdentity(credential, nonce);
  if (!identityIsValid) {
    return res.status(401).json({
      code: "INVALID_VERIFICATION",
      message: "Google verification failed. Please use the authorized account.",
    });
  }

  await replaceAdminPin(newPin);

  return res.json({ message: "Admin PIN updated. You can now sign in." });
}
