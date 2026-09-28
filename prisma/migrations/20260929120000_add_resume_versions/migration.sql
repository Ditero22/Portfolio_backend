CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SiteSettings" ADD COLUMN "activeResumeId" TEXT;

CREATE UNIQUE INDEX "ResumeVersion_objectKey_key" ON "ResumeVersion"("objectKey");
CREATE UNIQUE INDEX "SiteSettings_activeResumeId_key" ON "SiteSettings"("activeResumeId");

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_activeResumeId_fkey"
FOREIGN KEY ("activeResumeId") REFERENCES "ResumeVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
