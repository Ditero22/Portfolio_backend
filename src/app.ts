import express from "express";
import cors from "cors";

import authRouter from "./modules/auth/routes/auth.routes.js";
import blogRouter from "./modules/blog/routes/blog.routes.js";
import uploadRouter from "./modules/blog/routes/upload.routes.js";
import projectRouter from "./modules/project/routes/project.routes.js";
import projectUploadRouter from "./modules/project/routes/upload.routes.js";
import experienceRouter from "./modules/experience/routes/experience.routes.js";
import portfolioContentRouter from "./modules/portfolioContent/routes/portfolioContent.routes.js";
import settingsRouter from "./modules/settings/routes/settings.routes.js";
import analyticsRouter from "./modules/analytics/routes/analytics.routes.js";
import {
  apiRateLimit,
  loginRateLimit,
  pinResetRateLimit,
  uploadRateLimit,
} from "./middleware/rate-limit.middleware.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "./middleware/auth.middleware.js";

const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}
app.set("trust proxy", trustProxyHops);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  }),
);

app.use("/api", apiRateLimit);
app.use("/api/auth/login", loginRateLimit);
app.use("/api/auth/pin-reset", pinResetRateLimit);
app.use("/api/blog/upload", uploadRateLimit);
app.use("/api/projects/upload", uploadRateLimit);
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

// Blog image upload routes
app.use("/api/blog", uploadRouter);
app.use("/api/projects", projectUploadRouter);
app.get("/api/admin/test", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    message: "Admin access granted.",
    user: req.user,
  });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    console.error("Unhandled API request error.");
    res.status(500).json({ message: "Internal server error." });
  },
);

export default app;
