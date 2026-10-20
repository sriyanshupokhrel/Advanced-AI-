import { createHash } from "node:crypto";
import { cvSchema } from "@/lib/validation/cv-schema";
import {
  REVIEW_SECTIONS,
  REVIEW_SECTION_LABELS,
  jobDescriptionSchema,
  type ReviewSection,
} from "@/lib/validation/job-schema";
import {
  PAYLOAD_CONTRACT_VERSION,
  VERIFICATION_DISCLAIMER,
  type InterviewPreparationPayload,
  type PayloadImage,
  type ReadinessIssue,
  type SectionConfirmation,
} from "@/types/integration";
import type { CvImageDto, CvProfileDto } from "@/types/cv";
import type { ConfirmationStatus, JobDescriptionDto } from "@/types/job";

/**
 * Builds the interview-preparation payload (src/types/integration.ts) and
 * decides whether it is READY. Pure data mapping and rule checking: nothing
 * here interprets, ranks or matches the content.
 *
 * Confirmation model
 * - Each of the seven sections has its own SHA-256 fingerprint, computed from
 *   exactly the content shown to the user. Confirming stores that fingerprint.
 * - A section is CONFIRMED only while its current fingerprint equals the one
 *   confirmed. Any edit (including reordering) makes it
 *   CHANGED_SINCE_CONFIRMATION. Timestamps are not part of the content, so
 *   re-saving unchanged data keeps the confirmation.
 * - Images are confirmed individually (see image-evidence.ts); project images
 *   are therefore excluded from the PROJECTS fingerprint.
 */

const orNull = (value: string) => (value === "" ? null : value);
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function resolveConfirmationStatus(confirmedHash: string | null, currentFingerprint: string): ConfirmationStatus {
  if (!confirmedHash) return "NOT_CONFIRMED";
  return confirmedHash === currentFingerprint ? "CONFIRMED" : "CHANGED_SINCE_CONFIRMATION";
}

// ---------------------------------------------------------------------------
// Section content (what the user reviews, and what is fingerprinted)
// ---------------------------------------------------------------------------

function sectionContents(cv: CvProfileDto, job: JobDescriptionDto) {
  return {
    PROFILE: {
      fullName: cv.fullName,
      headline: orNull(cv.headline),
      contact: {
        email: orNull(cv.email),
        phone: orNull(cv.phone),
        location: orNull(cv.location),
        website: orNull(cv.website),
      },
      professionalSummary: cv.summary,
    },
    EDUCATION: cv.education.map((e) => ({
      id: e.id,
      institution: e.institution,
      qualification: e.degree,
      fieldOfStudy: orNull(e.fieldOfStudy),
      startDate: orNull(e.startDate),
      endDate: orNull(e.endDate),
      grade: orNull(e.grade),
      description: orNull(e.description),
    })),
    EXPERIENCE: cv.experience.map((e) => ({
      id: e.id,
      jobTitle: e.role,
      employer: e.employer,
      location: orNull(e.location),
      startDate: e.startDate,
      endDate: e.isCurrent ? null : orNull(e.endDate),
      isCurrent: e.isCurrent,
      description: orNull(e.description),
    })),
    SKILLS: cv.skills.map((s) => ({ id: s.id, name: s.name, category: orNull(s.category) })),
    PROJECTS: cv.projects.map((p) => ({
      id: p.id,
      name: p.name,
      role: orNull(p.role),
      url: orNull(p.url),
      technologies: orNull(p.technologies),
      description: p.description,
    })),
    ACHIEVEMENTS: cv.achievements.map((a) => ({
      id: a.id,
      title: a.title,
      issuer: orNull(a.issuer),
      date: orNull(a.date),
      description: orNull(a.description),
    })),
    TARGET_JOB: {
      jobDescriptionId: job.id,
      jobTitle: orNull(job.title),
      company: { name: orNull(job.companyName), information: orNull(job.companyInfo) },
      jobReference: orNull(job.jobReference),
      descriptionText: job.description,
    },
  } satisfies Record<ReviewSection, unknown>;
}

export function computeSectionFingerprints(cv: CvProfileDto, job: JobDescriptionDto): Record<ReviewSection, string> {
  const contents = sectionContents(cv, job);
  return Object.fromEntries(REVIEW_SECTIONS.map((section) => [section, sha256(contents[section])])) as Record<
    ReviewSection,
    string
  >;
}

// ---------------------------------------------------------------------------
// Confirmation helpers
// ---------------------------------------------------------------------------

export interface StoredSectionConfirmation {
  section: string;
  confirmedHash: string;
  confirmedAt: Date;
}

function toConfirmation(status: ConfirmationStatus, confirmedAt: string | null): SectionConfirmation {
  return { status, isConfirmed: status === "CONFIRMED", confirmedAt, basis: "USER_REVIEW" };
}

function sectionConfirmation(stored: StoredSectionConfirmation | undefined, fingerprint: string): SectionConfirmation {
  return toConfirmation(
    resolveConfirmationStatus(stored?.confirmedHash ?? null, fingerprint),
    stored?.confirmedAt.toISOString() ?? null,
  );
}

function toPayloadImage(image: CvImageDto, fileAvailable: boolean): PayloadImage {
  return {
    imageId: image.id,
    kind: image.kind,
    url: image.url,
    mimeType: image.mimeType,
    originalFileName: image.originalName,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    sha256: image.sha256,
    fileAvailable,
    description: { altText: image.altText, caption: orNull(image.caption), source: "USER_PROVIDED" },
    provenance: "USER_UPLOADED_UNVERIFIED",
    confirmation: toConfirmation(image.confirmationStatus, image.confirmedAt),
    uploadedAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Readiness rules
// ---------------------------------------------------------------------------

const LIST_SECTION_FIELD: Record<string, ReviewSection> = {
  education: "EDUCATION",
  experience: "EXPERIENCE",
  skills: "SKILLS",
  projects: "PROJECTS",
  achievements: "ACHIEVEMENTS",
};

/**
 * Re-checks stored data against the current validation rules, so data saved
 * before a rule existed (or edited outside the app) is never passed on as if
 * it were valid.
 */
function validationIssues(cv: CvProfileDto, job: JobDescriptionDto): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const cvResult = cvSchema.safeParse(cv);
  if (!cvResult.success) {
    for (const issue of cvResult.error.issues.slice(0, 10)) {
      const section = LIST_SECTION_FIELD[String(issue.path[0])] ?? "PROFILE";
      issues.push({
        code: "INVALID_DATA",
        severity: "BLOCKING",
        section,
        itemId: null,
        message: `${REVIEW_SECTION_LABELS[section]}: ${issue.message} Fix it in the CV editor.`,
      });
    }
  }
  const jobResult = jobDescriptionSchema.safeParse(job);
  if (!jobResult.success) {
    for (const issue of jobResult.error.issues.slice(0, 5)) {
      issues.push({
        code: "INVALID_DATA",
        severity: "BLOCKING",
        section: "TARGET_JOB",
        itemId: null,
        message: `Target job: ${issue.message} Fix it in the job description editor.`,
      });
    }
  }
  return issues;
}

function collectIssues(params: {
  cv: CvProfileDto;
  job: JobDescriptionDto;
  sections: Record<ReviewSection, SectionConfirmation>;
  images: { image: PayloadImage; projectId: string | null; projectName: string | null }[];
}): ReadinessIssue[] {
  const { cv, job, sections, images } = params;
  const issues: ReadinessIssue[] = [];
  const blocking = (issue: Omit<ReadinessIssue, "severity">) => issues.push({ ...issue, severity: "BLOCKING" });
  const warning = (issue: Omit<ReadinessIssue, "severity">) => issues.push({ ...issue, severity: "WARNING" });

  for (const section of REVIEW_SECTIONS) {
    const label = REVIEW_SECTION_LABELS[section];
    const { status } = sections[section];
    if (status === "NOT_CONFIRMED")
      blocking({ code: "SECTION_NOT_CONFIRMED", section, itemId: null, message: `${label} has not been confirmed yet. Review it and click "Confirm".` });
    if (status === "CHANGED_SINCE_CONFIRMATION")
      blocking({
        code: "SECTION_CHANGED_SINCE_CONFIRMATION",
        section,
        itemId: null,
        message: `${label} was edited after you confirmed it. Review the current version and confirm it again.`,
      });
  }

  for (const { image, projectId, projectName } of images) {
    const section = projectId ? "PROJECTS" : "IMAGES";
    const where = projectName ? ` (project "${projectName}")` : "";
    const name = `Image "${image.description.altText}"${where}`;
    if (!image.fileAvailable)
      blocking({ code: "IMAGE_FILE_MISSING", section, itemId: image.imageId, message: `${name}: the file is missing. Replace the file or delete the image.` });
    if (image.confirmation.status === "NOT_CONFIRMED")
      blocking({ code: "IMAGE_NOT_CONFIRMED", section, itemId: image.imageId, message: `${name} has not been confirmed. Check its description and project link, then confirm it (or delete it).` });
    if (image.confirmation.status === "CHANGED_SINCE_CONFIRMATION")
      blocking({ code: "IMAGE_CHANGED_SINCE_CONFIRMATION", section, itemId: image.imageId, message: `${name} was changed after you confirmed it. Review it and confirm it again.` });
  }

  issues.push(...validationIssues(cv, job));

  const lists: [ReviewSection, unknown[]][] = [
    ["EDUCATION", cv.education],
    ["EXPERIENCE", cv.experience],
    ["SKILLS", cv.skills],
    ["PROJECTS", cv.projects],
    ["ACHIEVEMENTS", cv.achievements],
  ];
  for (const [section, items] of lists) {
    if (items.length === 0)
      warning({ code: "EMPTY_SECTION", section, itemId: null, message: `${REVIEW_SECTION_LABELS[section]} is empty. If that is intended, you can still confirm it.` });
  }
  if (!cv.email && !cv.phone)
    warning({ code: "NO_CONTACT_DETAILS", section: "PROFILE", itemId: null, message: "The CV has no email address or phone number." });
  for (const project of cv.projects) {
    if (!images.some((i) => i.projectId === project.id))
      warning({ code: "PROJECT_HAS_NO_IMAGES", section: "PROJECTS", itemId: project.id, message: `Project "${project.name}" has no images. Images are optional but give the multimodal presentation visual material.` });
  }
  if (!job.title) warning({ code: "JOB_TITLE_MISSING", section: "TARGET_JOB", itemId: null, message: "The target job has no job title." });
  if (!job.companyName)
    warning({ code: "COMPANY_NAME_MISSING", section: "TARGET_JOB", itemId: null, message: "The target job has no company name." });

  return issues;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export function buildInterviewPreparationPayload(params: {
  targetId: string;
  cv: CvProfileDto;
  job: JobDescriptionDto;
  confirmations: StoredSectionConfirmation[];
  /** Ids of images whose files are missing from storage. */
  missingImageIds?: ReadonlySet<string>;
}): InterviewPreparationPayload {
  const { targetId, cv, job, confirmations } = params;
  const missing = params.missingImageIds ?? new Set<string>();
  const contents = sectionContents(cv, job);
  const fingerprints = computeSectionFingerprints(cv, job);
  const stored = new Map(confirmations.map((c) => [c.section, c]));
  const sections = Object.fromEntries(
    REVIEW_SECTIONS.map((section) => [section, sectionConfirmation(stored.get(section), fingerprints[section])]),
  ) as Record<ReviewSection, SectionConfirmation>;

  const projectNames = new Map(cv.projects.map((p) => [p.id, p.name]));
  const images = cv.images.map((image) => ({
    image: toPayloadImage(image, !missing.has(image.id)),
    // An image whose project no longer exists is treated as unlinked.
    projectId: image.projectId && projectNames.has(image.projectId) ? image.projectId : null,
    projectName: image.projectId ? projectNames.get(image.projectId) ?? null : null,
  }));

  const issues = collectIssues({ cv, job, sections, images });
  const isReady = !issues.some((issue) => issue.severity === "BLOCKING");
  const confirmationTimes = [
    ...REVIEW_SECTIONS.map((s) => sections[s].confirmedAt),
    ...images.map((i) => i.image.confirmation.confirmedAt),
  ].filter((t): t is string => t !== null);

  return {
    contractVersion: PAYLOAD_CONTRACT_VERSION,
    targetId,
    generatedAt: new Date().toISOString(),
    verificationDisclaimer: VERIFICATION_DISCLAIMER,
    readiness: {
      status: isReady ? "READY" : "ACTION_REQUIRED",
      isReady,
      readySince: isReady && confirmationTimes.length > 0 ? confirmationTimes.sort().at(-1)! : null,
      sections: { confirmed: REVIEW_SECTIONS.filter((s) => sections[s].isConfirmed).length, total: REVIEW_SECTIONS.length },
      images: { confirmed: images.filter((i) => i.image.confirmation.isConfirmed).length, total: images.length },
      issues,
    },
    candidate: {
      cvProfileId: cv.id,
      createdAt: cv.createdAt,
      lastUpdatedAt: cv.updatedAt,
      profile: { confirmation: sections.PROFILE, ...contents.PROFILE },
      education: { confirmation: sections.EDUCATION, items: contents.EDUCATION },
      workExperience: { confirmation: sections.EXPERIENCE, items: contents.EXPERIENCE },
      skills: { confirmation: sections.SKILLS, items: contents.SKILLS },
      projects: {
        confirmation: sections.PROJECTS,
        items: contents.PROJECTS.map((project) => ({
          ...project,
          images: images.filter((i) => i.projectId === project.id).map((i) => i.image),
        })),
      },
      achievements: { confirmation: sections.ACHIEVEMENTS, items: contents.ACHIEVEMENTS },
      otherImages: images.filter((i) => i.projectId === null).map((i) => i.image),
    },
    targetJob: {
      confirmation: sections.TARGET_JOB,
      ...contents.TARGET_JOB,
      createdAt: job.createdAt,
      lastUpdatedAt: job.updatedAt,
    },
    fingerprints,
  };
}

/** Overall status for lists and badges. */
export function overallConfirmationStatus(payload: InterviewPreparationPayload): ConfirmationStatus {
  if (payload.readiness.isReady) return "CONFIRMED";
  const changed = payload.readiness.issues.some(
    (i) => i.code === "SECTION_CHANGED_SINCE_CONFIRMATION" || i.code === "IMAGE_CHANGED_SINCE_CONFIRMATION",
  );
  return changed ? "CHANGED_SINCE_CONFIRMATION" : "NOT_CONFIRMED";
}
