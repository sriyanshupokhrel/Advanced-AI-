/*
  Warnings:

  - You are about to drop the column `confirmedAt` on the `CvJobTarget` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedHash` on the `CvJobTarget` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TargetSectionConfirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "confirmedHash" TEXT NOT NULL,
    "confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TargetSectionConfirmation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CvJobTarget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CvJobTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CvJobTarget_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CvJobTarget_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CvJobTarget" ("createdAt", "cvProfileId", "id", "jobDescriptionId", "updatedAt") SELECT "createdAt", "cvProfileId", "id", "jobDescriptionId", "updatedAt" FROM "CvJobTarget";
DROP TABLE "CvJobTarget";
ALTER TABLE "new_CvJobTarget" RENAME TO "CvJobTarget";
CREATE INDEX "CvJobTarget_jobDescriptionId_idx" ON "CvJobTarget"("jobDescriptionId");
CREATE UNIQUE INDEX "CvJobTarget_cvProfileId_jobDescriptionId_key" ON "CvJobTarget"("cvProfileId", "jobDescriptionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TargetSectionConfirmation_targetId_section_key" ON "TargetSectionConfirmation"("targetId", "section");
