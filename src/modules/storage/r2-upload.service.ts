import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

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

export async function uploadImageToR2(
  filePath: string,
  fileName: string,
  mimeType: string,
): Promise<R2UploadResult> {
  const extension = fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  const objectKey = `blog/${randomUUID()}${extension ? `.${extension}` : ""}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: fs.createReadStream(filePath),
      ContentType: mimeType,
    }),
  );

  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return {
    objectKey,
    fileName,
    imageUrl: `${publicUrl}/${encodedKey}`,
  };
}
