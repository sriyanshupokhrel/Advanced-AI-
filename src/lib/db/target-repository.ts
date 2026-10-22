import { Prisma } from "@prisma/client";
import { cvInclude, toCvDto } from "@/lib/db/cv-repository";
import { findMissingImageFiles } from "@/lib/db/image-repository";
import { jobInclude, toJobDto } from "@/lib/db/job-repository";
import { prisma } from "@/lib/db/prisma";
import {
  buildInterviewPreparationPayload,
  overallConfirmationStatus,
} from "@/lib/integration/interview-payload";
import { REVIEW_SECTIONS, REVIEW_SECTION_LABELS, type ReviewSection, type TargetConfirmationInput } from "@/lib/validation/job-schema";
import type { InterviewPreparationPayload } from "@/types/integration";
import type { CvJobTargetDto } from "@/types/job";

/**
 * CV ⇄ job pairings ("targets") and their review/confirmation state. Each
 * pairing is unique per (CV, job) and is removed automatically when either
 * side is deleted.
 */

export class TargetReferenceError extends Error {
  constructor(
    readonly field: "cvProfileId" | "jobDescriptionId",
    message: string,
  ) {
    super(message);
  }
}

/** The data changed between the user viewing it and confirming it. */
export class StaleReviewError extends Error {
  constructor(readonly sections: ReviewSection[]) {
    super(
      `${sections.map((s) => REVIEW_SECTION_LABELS[s]).join(", ")} changed since this page was loaded. Reload the review page, check the latest version and confirm again.`,
    );
  }
}

const targetInclude = {
  cvProfile: { include: cvInclude },
  jobDescription: { include: jobInclude },
  sectionConfirmations: true,
} satisfies Prisma.CvJobTargetInclude;

type TargetWithRelations = Prisma.CvJobTargetGetPayload<{ include: typeof targetInclude }>;

/**
 * Builds the payload. File availability affects readiness, so the file system
 * is checked by default; pass `checkFiles: false` only where a quick status is
 * enough and files are checked elsewhere.
 */
async function toPayload(target: TargetWithRelations, checkFiles = true): Promise<InterviewPreparationPayload> {
  return buildInterviewPreparationPayload({
    targetId: target.id,
    cv: toCvDto(target.cvProfile),
    job: toJobDto(target.jobDescription),
    confirmations: target.sectionConfirmations,
    missingImageIds: checkFiles ? await findMissingImageFiles(target.cvProfile.images) : undefined,
  });
}

function toTargetDto(target: TargetWithRelations, payload: InterviewPreparationPayload): CvJobTargetDto {
  const sectionConfirmation = {
    PROFILE: payload.candidate.profile.confirmation,
    EDUCATION: payload.candidate.education.confirmation,
    EXPERIENCE: payload.candidate.workExperience.confirmation,
    SKILLS: payload.candidate.skills.confirmation,
    PROJECTS: payload.candidate.projects.confirmation,
    ACHIEVEMENTS: payload.candidate.achievements.confirmation,
    TARGET_JOB: payload.targetJob.confirmation,
  };
  const { readiness } = payload;
  return {
    id: target.id,
    cv: {
      id: target.cvProfile.id,
      fullName: target.cvProfile.fullName,
      headline: target.cvProfile.headline ?? "",
    },
    job: {
      id: target.jobDescription.id,
      title: target.jobDescription.title ?? "",
      companyName: target.jobDescription.companyName ?? "",
      jobReference: target.jobDescription.jobReference ?? "",
    },
    confirmationStatus: overallConfirmationStatus(payload),
    sections: Object.fromEntries(
      REVIEW_SECTIONS.map((s) => [s, { status: sectionConfirmation[s].status, confirmedAt: sectionConfirmation[s].confirmedAt }]),
    ) as CvJobTargetDto["sections"],
    readiness: {
      status: readiness.status,
      isReady: readiness.isReady,
      blockingIssues: readiness.issues.filter((i) => i.severity === "BLOCKING").length,
      sections: readiness.sections,
      images: readiness.images,
    },
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  };
}

type TargetDbClient = typeof prisma | Prisma.TransactionClient;

const findTarget = (id: string, db: TargetDbClient = prisma) =>
  db.cvJobTarget.findUnique({ where: { id }, include: targetInclude });

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listTargets(filter: { cvProfileId?: string; jobDescriptionId?: string } = {}) {
  const targets = await prisma.cvJobTarget.findMany({
    where: filter,
    include: targetInclude,
    orderBy: { updatedAt: "desc" },
  });
  return Promise.all(targets.map(async (target) => toTargetDto(target, await toPayload(target))));
}

export async function getTarget(id: string): Promise<CvJobTargetDto | null> {
  const target = await findTarget(id);
  return target ? toTargetDto(target, await toPayload(target)) : null;
}

/**
 * The selected CV, target job and all images in one payload, with
 * per-section and per-image confirmation and a readiness verdict.
 * This is the server-side integration interface for other modules.
 */
export async function getInterviewPreparationPayload(
  id: string,
  db: TargetDbClient = prisma,
): Promise<InterviewPreparationPayload | null> {
  const target = await findTarget(id, db);
  return target ? toPayload(target) : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Pairs a CV with a job. Idempotent: if the pair already exists, the existing
 * pairing is returned with `created: false`.
 */
export async function createTarget(cvProfileId: string, jobDescriptionId: string) {
  const [cv, job] = await Promise.all([
    prisma.cvProfile.count({ where: { id: cvProfileId } }),
    prisma.jobDescription.count({ where: { id: jobDescriptionId } }),
  ]);
  if (!cv) throw new TargetReferenceError("cvProfileId", "The selected CV no longer exists.");
  if (!job) throw new TargetReferenceError("jobDescriptionId", "The selected job description no longer exists.");

  const pair = { cvProfileId_jobDescriptionId: { cvProfileId, jobDescriptionId } };
  const existing = await prisma.cvJobTarget.findUnique({ where: pair, include: targetInclude });
  if (existing) return { target: toTargetDto(existing, await toPayload(existing)), created: false };

  try {
    const target = await prisma.cvJobTarget.create({
      data: { cvProfileId, jobDescriptionId },
      include: targetInclude,
    });
    return { target: toTargetDto(target, await toPayload(target)), created: true };
  } catch (error) {
    // Another request created the same pair at the same moment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = await prisma.cvJobTarget.findUniqueOrThrow({ where: pair, include: targetInclude });
      return { target: toTargetDto(target, await toPayload(target)), created: false };
    }
    throw error;
  }
}

/**
 * Confirms (or withdraws confirmation of) some or all sections. Confirming
 * records each section's fingerprint exactly as stored right now. If
 * `expectedFingerprints` are given and any differs from the current data, the
 * request is refused (StaleReviewError) and nothing is changed.
 * Returns null when the pairing does not exist.
 */
export async function setSectionConfirmations(id: string, input: TargetConfirmationInput) {
  const target = await findTarget(id);
  if (!target) return null;

  const sections = input.sections ? [...new Set(input.sections)] : [...REVIEW_SECTIONS];
  const { fingerprints } = await toPayload(target, false);

  if (input.confirmed && input.expectedFingerprints) {
    const stale = sections.filter((s) => {
      const expected = input.expectedFingerprints?.[s];
      return expected !== undefined && expected !== fingerprints[s];
    });
    if (stale.length > 0) throw new StaleReviewError(stale);
  }

  await prisma.$transaction(
    sections.map((section) =>
      input.confirmed
        ? prisma.targetSectionConfirmation.upsert({
            where: { targetId_section: { targetId: id, section } },
            create: { targetId: id, section, confirmedHash: fingerprints[section] },
            update: { confirmedHash: fingerprints[section], confirmedAt: new Date() },
          })
        : prisma.targetSectionConfirmation.deleteMany({ where: { targetId: id, section } }),
    ),
  );
  // Touch the pairing so lists sort by most recent review activity.
  await prisma.cvJobTarget.update({ where: { id }, data: { updatedAt: new Date() } });
  return getTarget(id);
}

export async function deleteTarget(id: string): Promise<boolean> {
  const { count } = await prisma.cvJobTarget.deleteMany({ where: { id } });
  return count > 0;
}
