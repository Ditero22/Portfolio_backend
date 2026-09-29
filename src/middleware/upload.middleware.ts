import { mkdir } from "node:fs";
import { randomUUID } from "node:crypto";
import multer from "multer";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir("uploads/portfolio", { recursive: true }, (error) =>
      cb(error, "uploads/portfolio"),
    );
  },

  filename: (_req, file, cb) => {
    // The uploaded name is untrusted; use a server-generated path-safe name.
    cb(null, `${randomUUID()}.upload`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
    fieldNameSize: 100,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(null, false);
      return;
    }

    cb(null, true);
  },
});

export default upload;
