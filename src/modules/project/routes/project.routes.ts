import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware.js";
import {
  createProject,
  deleteProject,
  getAdminProjects,
  getProjects,
  permanentlyDeleteProjectHandler,
  restoreProjectHandler,
  updateProject,
  updateProjectOrder,
} from "../controllers/project.controller.js";

const router = Router();

router.get("/projects", getProjects);
router.get("/admin/projects", requireAdmin, getAdminProjects);
router.patch("/admin/projects/order", requireAdmin, updateProjectOrder);
router.post("/projects", requireAdmin, createProject);
router.patch("/projects/:id", requireAdmin, updateProject);
router.delete("/projects/:id", requireAdmin, deleteProject);
router.post("/projects/:id/restore", requireAdmin, restoreProjectHandler);
router.delete(
  "/projects/:id/permanent",
  requireAdmin,
  permanentlyDeleteProjectHandler,
);

export default router;
