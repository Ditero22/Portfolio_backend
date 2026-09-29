import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRouter from "./modules/auth/routes/auth.routes.js";
import blogRouter from "./modules/blog/routes/blog.routes.js";
import uploadRouter from "./modules/blog/routes/upload.routes.js";
import projectRouter from "./modules/project/routes/project.routes.js";
import projectUploadRouter from "./modules/project/routes/upload.routes.js";
import experienceRouter from "./modules/experience/routes/experience.routes.js";
import portfolioContentRouter from "./modules/portfolioContent/routes/portfolioContent.routes.js";
import settingsRouter from "./modules/settings/routes/settings.routes.js";
import resumeRouter from "./modules/resume/routes/resume.routes.js";
import analyticsRouter from "./modules/analytics/routes/analytics.routes.js";
import {
  apiRateLimit,
  loginRateLimit,
  pinResetRateLimit,
  uploadRateLimit,
} from "./middleware/rate-limit.middleware.js";
import {
  type AuthenticatedRequest,
  requireAdmin,
} from "./middleware/auth.middleware.js";
import { logServerError } from "./security/safe-log.js";
import { getAllowedBrowserOrigins } from "./security/origins.js";

const app = express();

const defaultTrustProxyHops = process.env.NODE_ENV === "production" ? 1 : 0;
const trustProxyHops = Number(
  process.env.TRUST_PROXY_HOPS ?? defaultTrustProxyHops,
);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}
app.set("trust proxy", trustProxyHops);
const allowedOrigins = getAllowedBrowserOrigins();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'", "https://accounts.google.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "https://accounts.google.com"],
        connectSrc: ["'self'", "https:"],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    frameguard: { action: "deny" },
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use("/api", apiRateLimit);
app.use("/api/auth/login", loginRateLimit);
app.use("/api/auth/pin-reset", pinResetRateLimit);
app.use("/api/blog/upload", uploadRateLimit);
app.use("/api/projects/upload", uploadRateLimit);
app.use("/api/certifications/upload", uploadRateLimit);
app.use("/api/admin/resumes/upload", uploadRateLimit);
app.use(express.json({ limit: "100kb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Portfolio backend is running",
  });
});

// Authentication routes
app.use("/api/auth", authRouter);

// Blog CRUD routes
app.use("/api", blogRouter);
app.use("/api", projectRouter);
app.use("/api", experienceRouter);
app.use("/api", analyticsRouter);
app.use("/api", portfolioContentRouter);
app.use("/api", settingsRouter);
app.use("/api", resumeRouter);

// Blog image upload routes
app.use("/api/blog", uploadRouter);
app.use("/api/projects", projectUploadRouter);
app.get("/api/admin/test", requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    message: "Admin access granted.",
    user: req.user,
  });
});

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    logServerError("Unhandled API request error.", error);
    const type =
      typeof error === "object" && error !== null && "type" in error
        ? error.type
        : undefined;
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (type === "entity.too.large" || code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "Request body is too large." });
      return;
    }
    if (
      type === "entity.parse.failed" ||
      (typeof code === "string" && code.startsWith("LIMIT_"))
    ) {
      res.status(400).json({ message: "Request body contains invalid JSON." });
      return;
    }
    res.status(500).json({ message: "Internal server error." });
  },
);

export default app;
