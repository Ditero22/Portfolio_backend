import multer from "multer";

const maxResumeBytes = 15 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "docx"]);
const acceptedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxResumeBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    if (
      !extension ||
      !acceptedExtensions.has(extension) ||
      !acceptedMimeTypes.has(file.mimetype)
    ) {
      callback(new Error("Upload your resume as a PDF or DOCX file."));
      return;
    }
    callback(null, true);
  },
});

export default resumeUpload;
