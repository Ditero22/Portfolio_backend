import type { Request, Response } from "express";
import { createAccessToken, verifyAdminPin } from "../services/auth.service.js";

export async function login(req: Request, res: Response) {
  const { pin } = req.body;

  if (typeof pin !== "string" || !/^\d{8}$/.test(pin)) {
    return res.status(400).json({
      message: "PIN must be exactly 8 digits.",
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
