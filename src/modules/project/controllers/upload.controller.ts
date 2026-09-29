import fs from "node:fs/promises";
import type { Request, Response } from "express";
import { uploadImageToR2 } from "../../storage/r2-upload.service.js";
import { logServerError } from "../../../security/safe-log.js";

export async function uploadProjectImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No project image uploaded." });
      return;
    }

    const result = await uploadImageToR2(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      "projects",
    );
    await fs.unlink(req.file.path);

    res.status(201).json({
      message: "Project image uploaded successfully.",
      imageUrl: result.imageUrl,
      objectKey: result.objectKey,
      fileName: result.fileName,
    });
  } catch (error) {
    logServerError("R2 project image upload failed.", error);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({ message: "Failed to upload project image." });
  }
}
