-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "companyName" TEXT,
    "companyInfo" TEXT,
    "jobReference" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CvJobTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "confirmedAt" DATETIME,
    "confirmedHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CvJobTarget_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CvJobTarget_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CvJobTarget_jobDescriptionId_idx" ON "CvJobTarget"("jobDescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CvJobTarget_cvProfileId_jobDescriptionId_key" ON "CvJobTarget"("cvProfileId", "jobDescriptionId");
