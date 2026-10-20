-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CvImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "altText" TEXT NOT NULL,
    "caption" TEXT,
    "confirmedAt" DATETIME,
    "confirmedHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CvImage_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CvImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CvImage" ("altText", "caption", "createdAt", "cvProfileId", "id", "kind", "mimeType", "originalName", "projectId", "sizeBytes", "storedFileName") SELECT "altText", "caption", "createdAt", "cvProfileId", "id", "kind", "mimeType", "originalName", "projectId", "sizeBytes", "storedFileName" FROM "CvImage";
DROP TABLE "CvImage";
ALTER TABLE "new_CvImage" RENAME TO "CvImage";
CREATE UNIQUE INDEX "CvImage_storedFileName_key" ON "CvImage"("storedFileName");
CREATE INDEX "CvImage_cvProfileId_idx" ON "CvImage"("cvProfileId");
CREATE INDEX "CvImage_projectId_idx" ON "CvImage"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
