import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { JobDescriptionDto, JobDescriptionInput, JobDescriptionSummaryDto } from "@/types/job";

/**
 * All job-description database access. The description text is written and
 * read back byte-for-byte; only the short optional fields are normalised
 * ("" ⇄ NULL).
 */

export const jobInclude = {
  _count: { select: { targets: true } },
} satisfies Prisma.JobDescriptionInclude;

export type JobWithCount = Prisma.JobDescriptionGetPayload<{ include: typeof jobInclude }>;

const nullIfEmpty = (value: string) => (value === "" ? null : value);
const emptyIfNull = (value: string | null) => value ?? "";

const EXCERPT_LENGTH = 200;

function jobData(input: JobDescriptionInput) {
  return {
    title: nullIfEmpty(input.title),
    companyName: nullIfEmpty(input.companyName),
    companyInfo: nullIfEmpty(input.companyInfo),
    jobReference: nullIfEmpty(input.jobReference),
    description: input.description,
  };
}

export function toJobDto(job: JobWithCount): JobDescriptionDto {
  return {
    id: job.id,
    title: emptyIfNull(job.title),
    companyName: emptyIfNull(job.companyName),
    companyInfo: emptyIfNull(job.companyInfo),
    jobReference: emptyIfNull(job.jobReference),
    description: job.description,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    targetCount: job._count.targets,
  };
}

export async function listJobSummaries(): Promise<JobDescriptionSummaryDto[]> {
  const jobs = await prisma.jobDescription.findMany({
    include: jobInclude,
    orderBy: { updatedAt: "desc" },
  });
  return jobs.map((job) => {
    const flat = job.description.replace(/\s+/g, " ").trim();
    return {
      id: job.id,
      title: emptyIfNull(job.title),
      companyName: emptyIfNull(job.companyName),
      jobReference: emptyIfNull(job.jobReference),
      excerpt: flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat,
      updatedAt: job.updatedAt.toISOString(),
      targetCount: job._count.targets,
    };
  });
}

export async function getJobById(id: string): Promise<JobDescriptionDto | null> {
  const job = await prisma.jobDescription.findUnique({ where: { id }, include: jobInclude });
  return job ? toJobDto(job) : null;
}

export async function createJob(input: JobDescriptionInput): Promise<JobDescriptionDto> {
  const job = await prisma.jobDescription.create({ data: jobData(input), include: jobInclude });
  return toJobDto(job);
}

/** Returns null when no job with this id exists. */
export async function updateJob(id: string, input: JobDescriptionInput): Promise<JobDescriptionDto | null> {
  const { count } = await prisma.jobDescription.updateMany({ where: { id }, data: jobData(input) });
  return count === 0 ? null : getJobById(id);
}

/** Deletes the job; its CV pairings are removed by cascade. */
export async function deleteJob(id: string): Promise<boolean> {
  const { count } = await prisma.jobDescription.deleteMany({ where: { id } });
  return count > 0;
}
