import express from "express";
import cors from "cors";

import authRouter from "./modules/auth/routes/auth.routes.js";
import blogRouter from "./modules/blog/routes/blog.routes.js";
import uploadRouter from "./modules/blog/routes/upload.routes.js";
import projectRouter from "./modules/project/routes/project.routes.js";
import experienceRouter from "./modules/experience/routes/experience.routes.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "./middleware/auth.middleware.js";

const app = express();

app.use(cors());

app.use(express.json());

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

// Blog image upload routes
app.use("/api/blog", uploadRouter);
app.get("/api/admin/test", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    message: "Admin access granted.",
    user: req.user,
  });
});

export default app;
