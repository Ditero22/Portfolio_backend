ALTER TABLE "Project"
ADD COLUMN "slug" TEXT,
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN "fullDescription" TEXT,
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "liveUrl" TEXT,
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Project"
SET "slug" = COALESCE(
  NULLIF(
    trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')),
    ''
  ),
  'project'
) || '-' || lower("id");

ALTER TABLE "Project"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_category_published_deletedAt_sortOrder_idx"
ON "Project"("category", "published", "deletedAt", "sortOrder");
