import type { Request, Response } from "express";

import {
  createBlogPost,
  deleteBlogPost,
  getAllBlogPosts,
  getPublishedBlogPostBySlug,
  getBlogPostById,
  updateBlogPost,
} from "../services/blog.service.js";

export async function getBlogPosts(_req: Request, res: Response) {
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

export async function getBlogPost(req: Request, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string") {
      res.status(400).json({
        message: "Invalid blog post ID.",
      });

      return;
    }

    const post = await getBlogPostById(id);

    if (!post || (!res.locals.includeDrafts && !post.published)) {
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

export async function createBlog(req: Request, res: Response) {
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

    if (
      published === true &&
      [title, excerpt, slug, category].some(
        (value) => !String(value ?? "").trim(),
      )
    ) {
      res
        .status(400)
        .json({
          message:
            "Add a title, slug, excerpt, and category before publishing.",
        });
      return;
    }

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

export async function updateBlog(req: Request, res: Response) {
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

    const willPublish = published ?? existingPost.published;
    const requiredDetails = [
      title ?? existingPost.title,
      excerpt ?? existingPost.excerpt,
      slug ?? existingPost.slug,
      category ?? existingPost.category,
    ];
    if (
      willPublish &&
      requiredDetails.some((value) => !String(value ?? "").trim())
    ) {
      res
        .status(400)
        .json({
          message:
            "Add a title, slug, excerpt, and category before publishing.",
        });
      return;
    }

    const post = await updateBlogPost(id, {
      title,
      excerpt,
      content,
      slug,
      category,
      imageUrl,
      link,
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

export async function deleteBlog(req: Request, res: Response) {
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
export async function getAdminBlogPosts(_req: Request, res: Response) {
  try {
    res.json(await getAllBlogPosts(true));
  } catch {
    res.status(500).json({ message: "Failed to fetch blog posts." });
  }
}

export async function getBlogPostBySlug(req: Request, res: Response) {
  try {
    if (typeof req.params.slug !== "string")
      return res.status(400).json({ message: "Invalid slug." });
    const post = await getPublishedBlogPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ message: "Blog post not found." });
    return res.json(post);
  } catch {
    return res.status(500).json({ message: "Failed to fetch blog post." });
  }
}
