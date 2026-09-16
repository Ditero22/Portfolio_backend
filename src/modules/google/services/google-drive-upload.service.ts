import fs from "node:fs";
import { google } from "googleapis";

import drive from "./google-drive.service.js";

const GOOGLE_DRIVE_FOLDER_ID =
  "1eNGn9pk7qVd69SbConyCwq_7MB8hfZ95";

export interface GoogleDriveUploadResult {
  fileId: string;
  fileName: string;
  imageUrl: string;
}

export async function uploadImageToGoogleDrive(
  filePath: string,
  fileName: string,
  mimeType: string,
): Promise<GoogleDriveUploadResult> {
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    },

    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },

    fields: "id, name",
  });

  const fileId = response.data.id;

  if (!fileId) {
    throw new Error(
      "Google Drive did not return a file ID.",
    );
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileId,
    fileName: response.data.name ?? fileName,
    imageUrl:
      `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}