import type { Request, Response } from "express";
import { logServerError } from "../../../security/safe-log.js";

import {
  createBlogPost,
  deleteBlogPost,
  getAllBlogPosts,
  getPublishedBlogPostBySlug,
  getBlogPostById,
  updateBlogPost,
} from "../services/blog.service.js";

const textLimits = {
  title: 160,
  excerpt: 1_200,
  content: 70_000,
  slug: 160,
  category: 80,
} as const;

type BlogInput = {
  title?: string;
  excerpt?: string;
  content?: string;
  slug?: string;
  category?: string;
  imageUrl?: string | null;
  link?: string | null;
  published?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseBlogInput(value: unknown, partial: boolean) {
  if (!isRecord(value)) return { error: "Provide valid blog post details." };
  const data: BlogInput = {};

  for (const [field, maxLength] of Object.entries(textLimits) as [
    keyof typeof textLimits,
    number,
  ][]) {
    const input = value[field];
    if (input === undefined && partial) continue;
    const text = input === undefined ? "" : input;
    if (typeof text !== "string" || text.length > maxLength) {
      return {
        error: `${field} must be text with no more than ${maxLength} characters.`,
      };
    }
    if (
      field === "slug" &&
      text.trim() &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(text)
    ) {
      return { error: "Slug may contain only letters, numbers, and hyphens." };
    }
    data[field] = text.trim();
  }

  for (const field of ["imageUrl", "link"] as const) {
    const input = value[field];
    if (input === undefined && partial) continue;
    if (input === null || input === undefined || input === "") {
      data[field] = null;
      continue;
    }
    if (
      typeof input !== "string" ||
      input.length > 2_048 ||
      !isSafeHttpUrl(input)
    ) {
      return { error: `${field} must be an HTTP or HTTPS URL.` };
    }
    data[field] = input.trim();
  }

  if (value.published !== undefined) {
    if (typeof value.published !== "boolean") {
      return { error: "published must be true or false." };
    }
    data.published = value.published;
  } else if (!partial) {
    data.published = false;
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "Provide at least one blog post field to update." };
  }
  return { data };
}

export async function getBlogPosts(_req: Request, res: Response) {
  try {
    const posts = await getAllBlogPosts();

    res.status(200).json(posts);
  } catch (error) {
    logServerError("Get blog posts failed.", error);

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
    logServerError("Get blog post failed.", error);

    res.status(500).json({
      message: "Failed to fetch blog post.",
    });
  }
}

export async function createBlog(req: Request, res: Response) {
  try {
    const parsed = parseBlogInput(req.body, false);
    if (!parsed.data) {
      res.status(400).json({ message: parsed.error });
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
    } = parsed.data;

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
      content: content ?? "",
      slug,
      category,
      imageUrl: imageUrl ?? null,
      link: link ?? null,
      published: published ?? false,
    });

    res.status(201).json(post);
  } catch (error) {
    logServerError("Create blog post failed.", error);

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

    const parsed = parseBlogInput(req.body, true);
    if (!parsed.data) {
      res.status(400).json({ message: parsed.error });
      return;
    }

    const existingPost = await getBlogPostById(id);

    if (!existingPost) {
      res.status(404).json({
        message: "Blog post not found.",
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
    } = parsed.data;
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
    logServerError("Update blog post failed.", error);

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
    logServerError("Delete blog post failed.", error);

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
