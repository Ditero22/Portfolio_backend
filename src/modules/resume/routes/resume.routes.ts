import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import resumeUpload from "../middleware/resume-upload.middleware.js";
import {
  activateResume,
  downloadAdminResume,
  downloadCurrentResume,
  getCurrentResume,
  listAdminResumes,
  uploadResume,
} from "../controllers/resume.controller.js";

const router = Router();

function handleResumeUploadError(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!error) {
    next();
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({
      message: "Resume files must be 15 MB or smaller.",
    });
    return;
  }

  response.status(400).json({
    message:
      error instanceof Error
        ? error.message
        : "Could not read the resume file.",
  });
}

router.get("/resume/current", getCurrentResume);
router.get("/resume/download", downloadCurrentResume);
router.get("/admin/resumes", requireAuth, listAdminResumes);
router.post(
  "/admin/resumes/upload",
  requireAuth,
  (request, response, next) => {
    resumeUpload.single("resume")(request, response, (error) => {
      handleResumeUploadError(error, request, response, next);
    });
  },
  uploadResume,
);
router.patch("/admin/resumes/:id/activate", requireAuth, activateResume);
router.get("/admin/resumes/:id/download", requireAuth, downloadAdminResume);

export default router;
