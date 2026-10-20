/**
 * Job description and CV–job pairing types returned by the API.
 * Optional text fields are "" (never null) when blank, matching src/types/cv.ts.
 */
import type { JobDescriptionInput, ReviewSection } from "@/lib/validation/job-schema";

export type { JobDescriptionInput };

/** A saved job description, as returned by GET /api/jobs/{id}. */
export interface JobDescriptionDto extends JobDescriptionInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Number of CVs this job is currently paired with. */
  targetCount: number;
}

/** Lightweight row for the job list, as returned by GET /api/jobs. */
export interface JobDescriptionSummaryDto {
  id: string;
  title: string;
  companyName: string;
  jobReference: string;
  /** First ~200 characters of the description, for display only. */
  excerpt: string;
  updatedAt: string;
  targetCount: number;
}

/**
 * - NOT_CONFIRMED: the user has not yet reviewed and confirmed the pair.
 * - CONFIRMED: confirmed, and neither the CV nor the job changed since.
 * - CHANGED_SINCE_CONFIRMATION: confirmed earlier, but the CV or the job has
 *   since been edited, so it must be reviewed again.
 */
export type ConfirmationStatus = "NOT_CONFIRMED" | "CONFIRMED" | "CHANGED_SINCE_CONFIRMATION";

/** A CV paired with a target job, as returned by /api/targets. */
export interface CvJobTargetDto {
  id: string;
  cv: { id: string; fullName: string; headline: string };
  job: { id: string; title: string; companyName: string; jobReference: string };
  /**
   * Overall: CONFIRMED only when everything is confirmed and READY;
   * CHANGED_SINCE_CONFIRMATION if any confirmed section or image was edited
   * afterwards; otherwise NOT_CONFIRMED.
   */
  confirmationStatus: ConfirmationStatus;
  sections: Record<ReviewSection, { status: ConfirmationStatus; confirmedAt: string | null }>;
  readiness: {
    status: "READY" | "ACTION_REQUIRED";
    isReady: boolean;
    blockingIssues: number;
    sections: { confirmed: number; total: number };
    images: { confirmed: number; total: number };
  };
  createdAt: string;
  updatedAt: string;
}
