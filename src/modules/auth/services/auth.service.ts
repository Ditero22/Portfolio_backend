import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../../database/prisma.js";

const googleOAuthClient = new OAuth2Client();

export async function verifyAdminPin(pin: string) {
  const admin = await prisma.user.findUnique({
    where: {
      id: "admin",
    },
  });

  if (!admin) {
    return false;
  }

  return bcrypt.compare(pin, admin.pinHash);
}

export function createAccessToken() {
  const secret = process.env.JWT_SECRET;

  if (!secret?.trim()) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      userId: "admin",
      role: "admin",
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "5h",
    },
  );
}

export async function verifyGoogleAdminIdentity(
  idToken: string,
  expectedNonce: string,
) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const allowedEmail = process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase();

  if (!clientId || !allowedEmail) {
    throw new Error("Google PIN recovery is not configured.");
  }

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    return Boolean(
      payload &&
      payload.email?.toLowerCase() === allowedEmail &&
      payload.email_verified === true &&
      payload.nonce === expectedNonce,
    );
  } catch {
    return false;
  }
}

export async function replaceAdminPin(pin: string) {
  const pinHash = await bcrypt.hash(pin, 12);

  await prisma.user.update({
    where: {
      id: "admin",
    },
    data: {
      pinHash,
    },
  });
}
