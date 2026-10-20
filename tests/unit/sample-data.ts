// Realistic, fictional records shaped exactly like the API DTOs, for unit tests.
import type { CvImageDto, CvProfileDto } from "@/types/cv";
import type { JobDescriptionDto } from "@/types/job";

export function sampleCv(overrides: Partial<CvProfileDto> = {}): CvProfileDto {
  return {
    id: "cv1",
    fullName: "Alex Morgan",
    headline: "Graduate Software Engineer",
    email: "alex@example.com",
    phone: "+61 400 123 456",
    location: "Sydney",
    website: "",
    summary: "Final-year software engineering student.",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    education: [
      { id: "ed1", institution: "UTS", degree: "BEng (Hons)", fieldOfStudy: "Software", startDate: "2022-02", endDate: "2025-11", grade: "", description: "" },
    ],
    experience: [
      { id: "ex1", employer: "Harbour Data Co.", role: "Intern", location: "", startDate: "2024-11", endDate: "2025-02", isCurrent: false, description: "Built dashboards." },
    ],
    skills: [
      { id: "sk1", name: "TypeScript", category: "Languages" },
      { id: "sk2", name: "SQL", category: "" },
    ],
    projects: [
      { id: "pr1", name: "Budget Buddy", role: "Lead", url: "", technologies: "Next.js", description: "A budgeting app." },
    ],
    achievements: [{ id: "ac1", title: "Dean's List", issuer: "", date: "2024-12", description: "" }],
    images: [],
    ...overrides,
  };
}

export function sampleImage(overrides: Partial<CvImageDto> = {}): CvImageDto {
  return {
    id: "img1",
    cvProfileId: "cv1",
    projectId: "pr1",
    kind: "PROJECT_SCREENSHOT",
    originalName: "dashboard.png",
    mimeType: "image/png",
    sizeBytes: 1000,
    width: 640,
    height: 480,
    sha256: "a".repeat(64),
    altText: "Dashboard",
    caption: "",
    url: "/api/images/img1?v=aaaaaaaaaaaa",
    confirmationStatus: "CONFIRMED",
    confirmedAt: "2026-10-02T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

export function sampleJob(overrides: Partial<JobDescriptionDto> = {}): JobDescriptionDto {
  return {
    id: "job1",
    title: "Graduate Software Engineer",
    companyName: "Harbourline Analytics",
    companyInfo: "",
    jobReference: "HLA-1",
    description: "We are hiring a graduate engineer to build data visualisation tools in TypeScript.\n",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    targetCount: 1,
    ...overrides,
  };
}
