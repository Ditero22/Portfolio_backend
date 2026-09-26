import { mkdir } from "node:fs";
import multer from "multer";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir("uploads/blog", { recursive: true }, (error) =>
      cb(error, "uploads/blog"),
    );
  },

  filename: (_req, file, cb) => {
    const extension =
      file.originalname.split(".").pop()?.toLowerCase() ?? "bin";

    const filename = `${Date.now()}-${Math.round(
      Math.random() * 1_000_000,
    )}.${extension}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WebP, and GIF images are allowed."));

      return;
    }

    cb(null, true);
  },
});

export default upload;
