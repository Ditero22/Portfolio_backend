import express from "express";
import cors from "cors";
import path from "node:path";

import authRouter from "./modules/auth/routes/auth.routes.js";
import blogRouter from "./modules/blog/routes/blog.routes.js";
import uploadRouter from "./modules/blog/routes/upload.routes.js";
import googleDriveRouter from "./modules/google/routes/google-drive.routes.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "./middleware/auth.middleware.js";

const app = express();

app.use(cors());

app.use(express.json());

// Serve uploaded files
app.use(
  "/uploads",
  express.static(path.resolve("uploads")),
);

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

// Blog image upload routes
app.use("/api/blog", uploadRouter);
app.use("/api", googleDriveRouter);
// Admin test route
app.get(
  "/api/admin/test",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    res.json({
      message: "Admin access granted.",
      user: req.user,
    });
  },
);

export default app;