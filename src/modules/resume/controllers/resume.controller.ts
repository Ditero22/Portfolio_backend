import type { Request, Response } from "express";
import prisma from "../../../database/prisma.js";
import {
  deleteR2Object,
  getR2ObjectData,
  uploadResumeToR2,
} from "../../storage/r2-upload.service.js";

const mimeTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function safeFileName(originalName: string) {
  const fileName = originalName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return fileName || "resume.pdf";
}

function isValidFile(buffer: Buffer, extension: string) {
  if (extension === "pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (extension === "docx")
    return buffer.subarray(0, 4).equals(Buffer.from("PK\u0003\u0004"));
  return false;
}

function publicResumeDetails(resume: {
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    fileName: resume.fileName,
    sizeBytes: resume.sizeBytes,
    uploadedAt: resume.createdAt,
  };
}

function sendAttachment(
  response: Response,
  resume: { fileName: string; mimeType: string; sizeBytes: number },
  buffer: Buffer,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", resume.mimeType);
  response.setHeader("Content-Length", resume.sizeBytes);
  response.attachment(resume.fileName);
  response.status(200).end(buffer);
}

export async function getCurrentResume(_request: Request, response: Response) {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "site" },
    include: { activeResume: true },
  });
  response.setHeader("Cache-Control", "no-store");
  response.json(
    settings?.activeResume ? publicResumeDetails(settings.activeResume) : null,
  );
}

export async function listAdminResumes(_request: Request, response: Response) {
  const [settings, versions] = await Promise.all([
    prisma.siteSettings.findUnique({
      where: { id: "site" },
      select: { activeResumeId: true },
    }),
    prisma.resumeVersion.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  response.setHeader("Cache-Control", "no-store");
  response.json(
    versions.map((version) => ({
      id: version.id,
      ...publicResumeDetails(version),
      mimeType: version.mimeType,
      isActive: version.id === settings?.activeResumeId,
    })),
  );
}

export async function uploadResume(request: Request, response: Response) {
  const file = request.file;
  if (!file) {
    response.status(400).json({ message: "Choose a PDF or DOCX resume." });
    return;
  }

  const fileName = safeFileName(file.originalname);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = mimeTypesByExtension[extension];
  if (!mimeType || !isValidFile(file.buffer, extension)) {
    response.status(400).json({
      message: "The file contents do not match a supported PDF or DOCX resume.",
    });
    return;
  }

  let objectKey: string | null = null;
  try {
    const uploaded = await uploadResumeToR2(file.buffer, fileName, mimeType);
    objectKey = uploaded.objectKey;
    const version = await prisma.$transaction(async (transaction) => {
      const created = await transaction.resumeVersion.create({
        data: {
          fileName,
          objectKey: uploaded.objectKey,
          mimeType,
          sizeBytes: file.size,
        },
      });
      await transaction.siteSettings.upsert({
        where: { id: "site" },
        create: { id: "site", isHired: false, activeResumeId: created.id },
        update: { activeResumeId: created.id },
      });
      return created;
    });

    response.status(201).json({
      id: version.id,
      ...publicResumeDetails(version),
      mimeType: version.mimeType,
      isActive: true,
    });
  } catch (error) {
    if (objectKey) await deleteR2Object(objectKey).catch(() => {});
    console.error("Resume upload failed.", error);
    response.status(502).json({
      message: "Could not save the resume. Please try again.",
    });
  }
}

export async function activateResume(request: Request, response: Response) {
  const id = String(request.params.id);
  const version = await prisma.resumeVersion.findUnique({ where: { id } });
  if (!version) {
    response.status(404).json({ message: "Resume version not found." });
    return;
  }

  await prisma.siteSettings.upsert({
    where: { id: "site" },
    create: { id: "site", isHired: false, activeResumeId: version.id },
    update: { activeResumeId: version.id },
  });
  response.json({
    id: version.id,
    ...publicResumeDetails(version),
    mimeType: version.mimeType,
    isActive: true,
  });
}

async function downloadVersion(
  version: {
    fileName: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
  },
  response: Response,
) {
  try {
    const buffer = await getR2ObjectData(version.objectKey);
    if (!buffer) {
      response.status(404).json({ message: "Resume file not found." });
      return;
    }
    sendAttachment(response, version, buffer);
  } catch {
    response.status(502).json({
      message: "Resume download is temporarily unavailable.",
    });
  }
}

export async function downloadCurrentResume(
  _request: Request,
  response: Response,
) {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "site" },
    include: { activeResume: true },
  });
  if (!settings?.activeResume) {
    response.status(404).json({ message: "No public resume is available." });
    return;
  }
  await downloadVersion(settings.activeResume, response);
}

export async function downloadAdminResume(
  request: Request,
  response: Response,
) {
  const version = await prisma.resumeVersion.findUnique({
    where: { id: String(request.params.id) },
  });
  if (!version) {
    response.status(404).json({ message: "Resume version not found." });
    return;
  }
  await downloadVersion(version, response);
}
