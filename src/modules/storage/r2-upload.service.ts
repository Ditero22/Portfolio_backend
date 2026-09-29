import { randomUUID } from "node:crypto";
import fs from "node:fs";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "");

if (
  !accountId ||
  !accessKeyId ||
  !secretAccessKey ||
  !bucketName ||
  !publicUrl
) {
  throw new Error("R2 environment variables are missing.");
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export interface R2UploadResult {
  objectKey: string;
  fileName: string;
  imageUrl: string;
}

let cachedUsage: {
  value: { bytes: number; objects: number };
  expiresAt: number;
} | null = null;

export async function getR2StorageUsage(): Promise<{
  bytes: number;
  objects: number;
} | null> {
  if (cachedUsage && cachedUsage.expiresAt > Date.now())
    return cachedUsage.value;

  let continuationToken: string | undefined;
  let bytes = 0;
  let objects = 0;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of result.Contents ?? []) {
      bytes += item.Size ?? 0;
      objects += 1;
    }
    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  const value = { bytes, objects };
  cachedUsage = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}

export async function uploadImageToR2(
  filePath: string,
  fileName: string,
  mimeType: string,
  prefix: "blog" | "projects" | "certifications" = "blog",
): Promise<R2UploadResult> {
  const extension = fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  const objectKey =
    prefix + "/" + randomUUID() + (extension ? "." + extension : "");

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: fs.createReadStream(filePath),
      ContentType: mimeType,
    }),
  );
  cachedUsage = null;

  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return {
    objectKey,
    fileName,
    imageUrl: `${publicUrl}/${encodedKey}`,
  };
}

export async function uploadResumeToR2(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "pdf";
  const objectKey = `resumes/${randomUUID()}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  cachedUsage = null;

  return { objectKey };
}

export async function getR2ObjectData(objectKey: string) {
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
  );
  if (!result.Body) return null;
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteR2Object(objectKey: string) {
  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
  );
  cachedUsage = null;
}
