import fs from "node:fs/promises";
import type { Request, Response } from "express";
import { uploadImageToR2 } from "../../storage/r2-upload.service.js";
import { logServerError } from "../../../security/safe-log.js";

export async function uploadCertificationImage(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ message: "Choose a certification image to upload." });
    return;
  }

  try {
    const result = await uploadImageToR2(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      "certifications",
    );
    await fs.unlink(req.file.path);
    res.status(201).json({
      message: "Certification image uploaded successfully.",
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    logServerError("R2 certification image upload failed.", error);
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ message: "Failed to upload certification image." });
  }
}
