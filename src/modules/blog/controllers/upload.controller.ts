import fs from "node:fs/promises";
import type { Request, Response } from "express";

import {
  uploadImageToGoogleDrive,
} from "../../google/services/google-drive-upload.service.js";

export async function uploadBlogImage(
  req: Request,
  res: Response,
) {
  try {
    if (!req.file) {
      res.status(400).json({
        message: "No image uploaded.",
      });

      return;
    }

    const result = await uploadImageToGoogleDrive(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
    );

    // Remove the temporary local file
    // after it has been uploaded to Google Drive.
    await fs.unlink(req.file.path);

    res.status(201).json({
      message: "Image uploaded successfully.",
      imageUrl: result.imageUrl,
      fileId: result.fileId,
      fileName: result.fileName,
    });
  } catch (error) {
    console.error(
      "Google Drive blog image upload error:",
      error,
    );

    // Clean up the temporary file if it exists.
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({
      message: "Failed to upload image.",
    });
  }
}