import type { Express } from "express";

export interface UploadedBlogImage {
  imageUrl: string;

  file: {
    originalName: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

export function processBlogImageUpload(
  file: Express.Multer.File,
): UploadedBlogImage {
  return {
    imageUrl: `/uploads/blog/${file.filename}`,

    file: {
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    },
  };
}