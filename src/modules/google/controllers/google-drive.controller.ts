import type { Request, Response } from "express";

import drive from "../services/google-drive.service.js";

const GOOGLE_DRIVE_FOLDER_ID =
  "1eNGn9pk7qVd69SbConyCwq_7MB8hfZ95";

export async function testGoogleDrive(
  _req: Request,
  res: Response,
) {
  try {
    const response = await drive.files.get({
      fileId: GOOGLE_DRIVE_FOLDER_ID,
      fields: "id, name, mimeType",
    });

    res.status(200).json({
      message: "Google Drive connection successful.",
      folder: response.data,
    });
  } catch (error) {
    console.error("Google Drive test error:", error);

    res.status(500).json({
      message: "Google Drive connection failed.",
    });
  }
}