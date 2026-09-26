CREATE TYPE "PortfolioContentType" AS ENUM ('STACK', 'CERTIFICATION', 'RECOMMENDATION', 'SKILL');

CREATE TABLE "PortfolioContent" (
    "id" TEXT NOT NULL,
    "kind" "PortfolioContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "category" TEXT,
    "url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortfolioContent_kind_published_sortOrder_idx"
ON "PortfolioContent"("kind", "published", "sortOrder");

CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "isHired" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitorLog" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitorLog_visitedAt_idx" ON "VisitorLog"("visitedAt");
CREATE INDEX "VisitorLog_visitorId_visitedAt_idx" ON "VisitorLog"("visitorId", "visitedAt");
