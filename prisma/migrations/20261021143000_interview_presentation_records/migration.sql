-- CreateTable
CREATE TABLE "InterviewPresentationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "originalJson" TEXT NOT NULL,
    "draftJson" TEXT NOT NULL,
    "imageAnalysesJson" TEXT NOT NULL,
    "sourceSnapshotJson" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewPresentationRecord_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CvJobTarget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InterviewPresentationRecord_targetId_createdAt_idx" ON "InterviewPresentationRecord"("targetId", "createdAt");
