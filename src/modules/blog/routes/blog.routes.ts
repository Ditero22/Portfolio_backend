import { Router } from "express";

import {
  createBlog,
  deleteBlog,
  getBlogPost,
  getBlogPosts,
  getAdminBlogPosts,
  getBlogPostBySlug,
  updateBlog,
} from "../controllers/blog.controller.js";

import { requireAuth } from "../../../middleware/auth.middleware.js";

const router = Router();

/*
 * ============================
 * PUBLIC ROUTES
 * ============================
 */

// Get all blog posts
router.get("/blog", getBlogPosts);
router.get("/blog/slug/:slug", getBlogPostBySlug);
router.get("/admin/blog", requireAuth, getAdminBlogPosts);
router.get(
  "/admin/blog/:id",
  requireAuth,
  (_req, res, next) => {
    res.locals.includeDrafts = true;
    next();
  },
  getBlogPost,
);

// Get one blog post by ID
router.get("/blog/:id", getBlogPost);

/*
 * ============================
 * ADMIN ROUTES
 * ============================
 */

// Create blog post
router.post("/blog", requireAuth, createBlog);

// Update blog post
router.patch("/blog/:id", requireAuth, updateBlog);

// Delete blog post
router.delete("/blog/:id", requireAuth, deleteBlog);

export default router;
