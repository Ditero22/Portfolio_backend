import prisma from "../../../database/prisma.js";

interface CreateBlogPostData {
  title: string;
  excerpt: string;
  content: string;
  slug: string;
  category: string;
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

export async function getAllBlogPosts() {
  return prisma.blogPost.findMany({
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

export async function createBlogPost(
  data: CreateBlogPostData,
) {
  return prisma.blogPost.create({
    data: {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      slug: data.slug,
      category: data.category,
      imageUrl: data.imageUrl ?? null,
      link: data.link ?? null,
      published: data.published ?? false,
    },
  });
}

export async function updateBlogPost(
  id: string,
  data: UpdateBlogPostData,
) {
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