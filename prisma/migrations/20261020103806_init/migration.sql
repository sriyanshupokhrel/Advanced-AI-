-- CreateTable
CREATE TABLE "CvProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "website" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "grade" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Education_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Experience_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Skill_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "url" TEXT,
    "technologies" TEXT,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Project_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Achievement_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CvImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvProfileId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "altText" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CvImage_cvProfileId_fkey" FOREIGN KEY ("cvProfileId") REFERENCES "CvProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CvImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Education_cvProfileId_idx" ON "Education"("cvProfileId");

-- CreateIndex
CREATE INDEX "Experience_cvProfileId_idx" ON "Experience"("cvProfileId");

-- CreateIndex
CREATE INDEX "Skill_cvProfileId_idx" ON "Skill"("cvProfileId");

-- CreateIndex
CREATE INDEX "Project_cvProfileId_idx" ON "Project"("cvProfileId");

-- CreateIndex
CREATE INDEX "Achievement_cvProfileId_idx" ON "Achievement"("cvProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CvImage_storedFileName_key" ON "CvImage"("storedFileName");

-- CreateIndex
CREATE INDEX "CvImage_cvProfileId_idx" ON "CvImage"("cvProfileId");

-- CreateIndex
CREATE INDEX "CvImage_projectId_idx" ON "CvImage"("projectId");
