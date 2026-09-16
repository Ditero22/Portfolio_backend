import type { Request, Response } from "express";

import {
  createBlogPost,
  deleteBlogPost,
  getAllBlogPosts,
  getBlogPostById,
  updateBlogPost,
} from "../services/blog.service.js";

export async function getBlogPosts(
  _req: Request,
  res: Response,
) {
  try {
    const posts = await getAllBlogPosts();

    res.status(200).json(posts);
  } catch (error) {
    console.error("Get blog posts error:", error);

    res.status(500).json({
      message: "Failed to fetch blog posts.",
    });
  }
}

export async function getBlogPost(
  req: Request,
  res: Response,
) {
  try {
    const id = req.params.id;

    if (typeof id !== "string") {
      res.status(400).json({
        message: "Invalid blog post ID.",
      });

      return;
    }

    const post = await getBlogPostById(id);

    if (!post) {
      res.status(404).json({
        message: "Blog post not found.",
      });

      return;
    }

    res.status(200).json(post);
  } catch (error) {
    console.error("Get blog post error:", error);

    res.status(500).json({
      message: "Failed to fetch blog post.",
    });
  }
}

export async function createBlog(
  req: Request,
  res: Response,
) {
  try {
    const {
      title,
      excerpt,
      content,
      slug,
      category,
      imageUrl,
      link,
      published,
    } = req.body;

    const post = await createBlogPost({
      title,
      excerpt,
      content,
      slug,
      category,
      imageUrl: imageUrl ?? null,
      link: link ?? null,
      published: published ?? false,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Create blog post error:", error);

    res.status(500).json({
      message: "Failed to create blog post.",
    });
  }
}

export async function updateBlog(
  req: Request,
  res: Response,
) {
  try {
    const id = req.params.id;

    if (typeof id !== "string") {
      res.status(400).json({
        message: "Invalid blog post ID.",
      });

      return;
    }

    const {
      title,
      excerpt,
      content,
      slug,
      category,
      imageUrl,
      link,
      published,
    } = req.body;

    const existingPost = await getBlogPostById(id);

    if (!existingPost) {
      res.status(404).json({
        message: "Blog post not found.",
      });

      return;
    }

    const post = await updateBlogPost(id, {
      title,
      excerpt,
      content,
      slug,
      category,
      imageUrl: imageUrl ?? null,
      link: link ?? null,
      published,
    });

    res.status(200).json(post);
  } catch (error) {
    console.error("Update blog post error:", error);

    res.status(500).json({
      message: "Failed to update blog post.",
    });
  }
}

export async function deleteBlog(
  req: Request,
  res: Response,
) {
  try {
    const id = req.params.id;

    if (typeof id !== "string") {
      res.status(400).json({
        message: "Invalid blog post ID.",
      });

      return;
    }

    const existingPost = await getBlogPostById(id);

    if (!existingPost) {
      res.status(404).json({
        message: "Blog post not found.",
      });

      return;
    }

    await deleteBlogPost(id);

    res.status(200).json({
      message: "Blog post deleted successfully.",
    });
  } catch (error) {
    console.error("Delete blog post error:", error);

    res.status(500).json({
      message: "Failed to delete blog post.",
    });
  }
}