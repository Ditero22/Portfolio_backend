import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../../database/prisma.js";

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

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      userId: "admin",
      role: "admin",
    },
    secret,
    {
      expiresIn: "1h",
    },
  );
}