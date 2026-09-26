import { randomUUID } from "node:crypto";
import prisma from "../../../database/prisma.js";

interface CreateBlogPostData {
  title?: string;
  excerpt?: string;
  content: string;
  slug?: string;
  category?: string;
  imageUrl?: string | null;
  link?: string | null;
  published?: boolean;
}

interface UpdateBlogPostData {
  title?: string;
  excerpt?: string;
  content?: string;
  slug?: string;
  category?: string;
  imageUrl?: string | null;
  link?: string | null;
  published?: boolean;
}

export async function getAllBlogPosts(includeDrafts = false) {
  return prisma.blogPost.findMany({
    where: includeDrafts ? {} : { published: true },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getBlogPostById(id: string) {
  return prisma.blogPost.findUnique({
    where: {
      id,
    },
  });
}

export async function createBlogPost(data: CreateBlogPostData) {
  const isDraft = data.published !== true;
  const missingDetails =
    !data.title?.trim() ||
    !data.excerpt?.trim() ||
    !data.slug?.trim() ||
    !data.category?.trim();
  if (!isDraft && missingDetails)
    throw new Error(
      "Title, slug, excerpt, and category are required to publish a post.",
    );

  const draftNumber = !data.title?.trim()
    ? (await prisma.blogPost.count({
        where: { published: false, title: { startsWith: "Draft " } },
      })) + 1
    : undefined;

  return prisma.blogPost.create({
    data: {
      title: data.title?.trim() || `Draft ${draftNumber}`,
      excerpt: data.excerpt?.trim() || "",
      content: data.content,
      slug: data.slug?.trim() || `draft-${randomUUID()}`,
      category: data.category?.trim() || "",
      imageUrl: data.imageUrl ?? null,
      link: data.link ?? null,
      published: data.published ?? false,
    },
  });
}

export async function updateBlogPost(id: string, data: UpdateBlogPostData) {
  return prisma.blogPost.update({
    where: {
      id,
    },
    data: {
      ...(data.title !== undefined && {
        title: data.title,
      }),

      ...(data.excerpt !== undefined && {
        excerpt: data.excerpt,
      }),

      ...(data.content !== undefined && {
        content: data.content,
      }),

      ...(data.slug !== undefined && {
        slug: data.slug,
      }),

      ...(data.category !== undefined && {
        category: data.category,
      }),

      ...(data.imageUrl !== undefined && {
        imageUrl: data.imageUrl,
      }),

      ...(data.link !== undefined && {
        link: data.link,
      }),

      ...(data.published !== undefined && {
        published: data.published,
      }),
    },
  });
}

export async function deleteBlogPost(id: string) {
  return prisma.blogPost.delete({
    where: {
      id,
    },
  });
}
export async function getPublishedBlogPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({ where: { slug, published: true } });
}
