import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

const adminUserId = "admin";
const maxTokenAge = "5h";

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const token = authorization.substring(7);
  const secret = process.env.JWT_SECRET;

  if (!secret?.trim()) {
    return res.status(500).json({
      message: "JWT_SECRET is not configured.",
    });
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      maxAge: maxTokenAge,
    });

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

/** Require the one admin identity this portfolio supports. */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  return requireAuth(req, res, () => {
    if (req.user?.userId !== adminUserId || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }
    next();
  });
}
