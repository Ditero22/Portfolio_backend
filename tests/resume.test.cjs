const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "isolated-resume-test-secret";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://storage.example.test";

const prisma = require("../dist/database/prisma.js").default;
const storage = require("../dist/modules/storage/r2-upload.service.js");
const router =
  require("../dist/modules/resume/routes/resume.routes.js").default;

test("resume uploads keep versions, activate latest, and allow switching back", async () => {
  const versions = new Map();
  const files = new Map();
  let activeResumeId = null;
  let nextId = 1;

  prisma.resumeVersion.findMany = async ({ orderBy }) =>
    [...versions.values()].sort((first, second) =>
      orderBy.createdAt === "desc"
        ? second.createdAt.getTime() - first.createdAt.getTime()
        : first.createdAt.getTime() - second.createdAt.getTime(),
    );
  prisma.resumeVersion.findUnique = async ({ where }) =>
    versions.get(where.id) ?? null;
  prisma.resumeVersion.create = async ({ data }) => {
    const version = {
      id: String(nextId++),
      createdAt: new Date(),
      ...data,
    };
    versions.set(version.id, version);
    return version;
  };
  prisma.siteSettings.findUnique = async ({ include }) => {
    if (include?.activeResume) {
      return {
        isHired: false,
        activeResumeId,
        activeResume: activeResumeId
          ? (versions.get(activeResumeId) ?? null)
          : null,
      };
    }
    return activeResumeId ? { activeResumeId } : null;
  };
  prisma.siteSettings.upsert = async ({ create, update }) => {
    activeResumeId = update.activeResumeId ?? create.activeResumeId;
    return { id: "site", isHired: false, activeResumeId };
  };
  prisma.$transaction = async (callback) => callback(prisma);

  const originalUpload = storage.uploadResumeToR2;
  const originalGet = storage.getR2ObjectData;
  const originalDelete = storage.deleteR2Object;
  storage.uploadResumeToR2 = async (buffer, fileName) => {
    const objectKey = `resumes/${fileName}`;
    files.set(objectKey, Buffer.from(buffer));
    return { objectKey };
  };
  storage.getR2ObjectData = async (objectKey) => files.get(objectKey) ?? null;
  storage.deleteR2Object = async (objectKey) => files.delete(objectKey);

  const app = express();
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign(
    { userId: "admin", role: "admin" },
    process.env.JWT_SECRET,
  );
  const authHeaders = { Authorization: `Bearer ${token}` };

  async function uploadPdf(fileName, body) {
    const formData = new FormData();
    formData.append(
      "resume",
      new Blob([body], { type: "application/pdf" }),
      fileName,
    );
    return fetch(`${base}/admin/resumes/upload`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
  }

  try {
    assert.equal((await fetch(`${base}/admin/resumes`)).status, 401);
    assert.equal(await (await fetch(`${base}/resume/current`)).json(), null);

    const firstPdf = Buffer.from("%PDF-1.7 first-version");
    const firstResponse = await uploadPdf("first.pdf", firstPdf);
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    assert.equal(first.isActive, true);
    assert.equal(first.fileName, "first.pdf");
    assert.equal(Object.hasOwn(first, "objectKey"), false);

    const secondPdf = Buffer.from("%PDF-1.7 second-version");
    const secondResponse = await uploadPdf("latest.pdf", secondPdf);
    assert.equal(secondResponse.status, 201);
    const second = await secondResponse.json();

    assert.equal((await fetch(`${base}/resume/current`)).status, 200);
    assert.equal(
      (await (await fetch(`${base}/resume/current`)).json()).fileName,
      "latest.pdf",
    );
    const listResponse = await fetch(`${base}/admin/resumes`, {
      headers: authHeaders,
    });
    const list = await listResponse.json();
    assert.equal(list.length, 2);
    assert.equal(list.find((item) => item.id === second.id).isActive, true);
    assert.equal(list.find((item) => item.id === first.id).isActive, false);

    const historicalDownload = await fetch(
      `${base}/admin/resumes/${first.id}/download`,
      { headers: authHeaders },
    );
    assert.equal(historicalDownload.status, 200);
    assert.equal(
      Buffer.from(await historicalDownload.arrayBuffer()).toString(),
      firstPdf.toString(),
    );

    const activateResponse = await fetch(
      `${base}/admin/resumes/${first.id}/activate`,
      { method: "PATCH", headers: authHeaders },
    );
    assert.equal(activateResponse.status, 200);
    assert.equal(
      (await (await fetch(`${base}/resume/current`)).json()).fileName,
      "first.pdf",
    );
    const publicDownload = await fetch(`${base}/resume/download`);
    assert.equal(publicDownload.status, 200);
    assert.match(
      publicDownload.headers.get("content-disposition"),
      /attachment/,
    );
    assert.equal(
      Buffer.from(await publicDownload.arrayBuffer()).toString(),
      firstPdf.toString(),
    );

    const invalidResponse = await uploadPdf("invalid.pdf", "not a PDF");
    assert.equal(invalidResponse.status, 400);
  } finally {
    storage.uploadResumeToR2 = originalUpload;
    storage.getR2ObjectData = originalGet;
    storage.deleteR2Object = originalDelete;
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
