import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";

const supportedSignatures = [
  {
    mimeType: "image/jpeg",
    extension: "jpg",
    matches: (bytes: Buffer) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extension: "png",
    matches: (bytes: Buffer) =>
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mimeType: "image/gif",
    extension: "gif",
    matches: (bytes: Buffer) =>
      bytes.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")),
  },
  {
    mimeType: "image/webp",
    extension: "webp",
    matches: (bytes: Buffer) =>
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
  },
] as const;

export function detectSupportedImage(bytes: Buffer) {
  return supportedSignatures.find((signature) => signature.matches(bytes));
}

export async function validateUploadedImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.file) {
    res.status(400).json({ message: "Choose a JPG, PNG, WebP, or GIF image." });
    return;
  }

  try {
    const contents = await fs.readFile(req.file.path);
    const detected = detectSupportedImage(contents);
    if (!detected || detected.mimeType !== req.file.mimetype) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({
        message: "The file contents do not match a supported image type.",
      });
      return;
    }

    req.file.originalname = `upload.${detected.extension}`;
    req.file.mimetype = detected.mimeType;
    next();
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
}
