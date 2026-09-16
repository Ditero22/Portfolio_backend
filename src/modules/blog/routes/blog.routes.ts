import { Router } from "express";

import {
  createBlog,
  deleteBlog,
  getBlogPost,
  getBlogPosts,
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

// Get one blog post by ID
router.get("/blog/:id", getBlogPost);


/*
 * ============================
 * ADMIN ROUTES
 * ============================
 */

// Create blog post
router.post(
  "/blog",
  requireAuth,
  createBlog,
);

// Update blog post
router.patch(
  "/blog/:id",
  requireAuth,
  updateBlog,
);

// Delete blog post
router.delete(
  "/blog/:id",
  requireAuth,
  deleteBlog,
);

export default router;