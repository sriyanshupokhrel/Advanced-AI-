/**
 * Integration contracts: the typed hand-over from the CV Builder to the next
 * development stage (the multimodal AI processing component).
 *
 * 1. InterviewPreparationPayload (v2.0): one CV + one target job + all images,
 *    with per-section and per-image confirmation and a readiness verdict.
 *    GET /api/targets/{id}/context  ·  getInterviewPreparationPayload()
 * 2. ImageEvidenceContext (v1.0): per-image view for a CV.
 *    GET /api/cvs/{id}/image-context  ·  getImageEvidenceForCv()
 *
 * Conventions:
 * - Optional values are `null` when the user did not provide them (never "").
 * - Month dates are "YYYY-MM"; fields named `...At` are ISO 8601 timestamps.
 * - Lists keep the order the user arranged them in.
 * - `targetJob.descriptionText` is the advert exactly as pasted.
 * - Ids are stable database ids (cuid); they survive edits and reorders.
 * - The CV Builder supplies data only. It never ranks, matches or interprets.
 *
 * "Confirmed" means the USER reviewed the information and said it is accurate.
 * It does not mean the application or the university verified any claim.
 */
import type { ImageKind } from "@/types/cv";
import type { ConfirmationStatus } from "@/types/job";
import type { ReviewSection } from "@/lib/validation/job-schema";

export type { ConfirmationStatus, ReviewSection };

export const PAYLOAD_CONTRACT_VERSION = "2.0" as const;

export const VERIFICATION_DISCLAIMER =
  "Confirmed information has been reviewed by the user. It has not been independently verified by the application or the university.";

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

export interface SectionConfirmation {
  status: ConfirmationStatus;
  /** True only when status is CONFIRMED. */
  isConfirmed: boolean;
  /** When the user last confirmed this section/image, or null. */
  confirmedAt: string | null;
  /** Always "USER_REVIEW": confirmation is the user's own statement. */
  basis: "USER_REVIEW";
}

/** Backwards-compatible name used by the image contract. */
export type ImageConfirmation = Omit<SectionConfirmation, "basis">;

/**
 * Uploaded images are supplied by the user and are NOT verified. They must not
 * be treated as proof of an achievement.
 */
export type ImageProvenance = "USER_UPLOADED_UNVERIFIED";

// ---------------------------------------------------------------------------
// Payload items
// ---------------------------------------------------------------------------

export interface PayloadImage {
  imageId: string;
  kind: ImageKind;
  /** Relative URL serving the file, e.g. /api/images/{id}?v=…; prefix with the app origin. */
  url: string;
  /** Validated from the file content, not from the file name. */
  mimeType: string;
  originalFileName: string;
  sizeBytes: number;
  /** Null only for images uploaded before dimensions were recorded. */
  width: number | null;
  height: number | null;
  sha256: string | null;
  /** False if the file is missing from storage. */
  fileAvailable: boolean;
  description: {
    /** The user's own description of the image (never AI-generated). */
    altText: string;
    caption: string | null;
    source: "USER_PROVIDED";
  };
  provenance: ImageProvenance;
  confirmation: SectionConfirmation;
  uploadedAt: string;
  updatedAt: string;
}

export interface PayloadEducation {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  grade: string | null;
  description: string | null;
}

export interface PayloadWorkExperience {
  id: string;
  jobTitle: string;
  employer: string;
  location: string | null;
  startDate: string;
  /** null when `isCurrent` is true. */
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface PayloadSkill {
  id: string;
  name: string;
  category: string | null;
}

export interface PayloadProject {
  id: string;
  name: string;
  role: string | null;
  url: string | null;
  /** Free text as entered by the user, e.g. "React, PostgreSQL". */
  technologies: string | null;
  description: string;
  /** Images linked to this project, each with its own confirmation. */
  images: PayloadImage[];
}

export interface PayloadAchievement {
  id: string;
  title: string;
  issuer: string | null;
  date: string | null;
  description: string | null;
}

/** A confirmable list section. */
export interface PayloadSection<T> {
  confirmation: SectionConfirmation;
  items: T[];
}

export interface PayloadCandidate {
  cvProfileId: string;
  createdAt: string;
  lastUpdatedAt: string;
  profile: {
    confirmation: SectionConfirmation;
    fullName: string;
    headline: string | null;
    contact: {
      email: string | null;
      phone: string | null;
      location: string | null;
      website: string | null;
    };
    professionalSummary: string;
  };
  education: PayloadSection<PayloadEducation>;
  workExperience: PayloadSection<PayloadWorkExperience>;
  skills: PayloadSection<PayloadSkill>;
  projects: PayloadSection<PayloadProject>;
  achievements: PayloadSection<PayloadAchievement>;
  /** Images not linked to a project (profile photo, certificates, …). */
  otherImages: PayloadImage[];
}

export interface PayloadTargetJob {
  confirmation: SectionConfirmation;
  jobDescriptionId: string;
  jobTitle: string | null;
  company: { name: string | null; information: string | null };
  jobReference: string | null;
  /** The complete job advert, verbatim. */
  descriptionText: string;
  createdAt: string;
  lastUpdatedAt: string;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type ReadinessIssueCode =
  // Blocking: the payload must not be treated as user-confirmed.
  | "SECTION_NOT_CONFIRMED"
  | "SECTION_CHANGED_SINCE_CONFIRMATION"
  | "IMAGE_NOT_CONFIRMED"
  | "IMAGE_CHANGED_SINCE_CONFIRMATION"
  | "IMAGE_FILE_MISSING"
  | "INVALID_DATA"
  // Warnings: worth knowing, never blocking.
  | "EMPTY_SECTION"
  | "NO_CONTACT_DETAILS"
  | "JOB_TITLE_MISSING"
  | "COMPANY_NAME_MISSING"
  | "PROJECT_HAS_NO_IMAGES";

export interface ReadinessIssue {
  code: ReadinessIssueCode;
  severity: "BLOCKING" | "WARNING";
  /** The section the issue belongs to, or "IMAGES" for unlinked images. */
  section: ReviewSection | "IMAGES";
  /** The specific item (image or project id), when the issue is about one. */
  itemId: string | null;
  /** Plain-language explanation for the user. */
  message: string;
}

export interface PayloadReadiness {
  /**
   * READY: every section and every image is confirmed, nothing has changed
   * since, and no blocking issue remains. Otherwise ACTION_REQUIRED.
   */
  status: "READY" | "ACTION_REQUIRED";
  isReady: boolean;
  /** When the last outstanding confirmation was given, if READY. */
  readySince: string | null;
  sections: { confirmed: number; total: number };
  images: { confirmed: number; total: number };
  issues: ReadinessIssue[];
}

// ---------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------

export interface InterviewPreparationPayload {
  contractVersion: typeof PAYLOAD_CONTRACT_VERSION;
  targetId: string;
  generatedAt: string;
  verificationDisclaimer: typeof VERIFICATION_DISCLAIMER;
  readiness: PayloadReadiness;
  candidate: PayloadCandidate;
  targetJob: PayloadTargetJob;
  /**
   * Current SHA-256 fingerprint of each section's content. The review page
   * echoes these back when confirming so that only what the user saw is
   * confirmed.
   */
  fingerprints: Record<ReviewSection, string>;
}

// ---------------------------------------------------------------------------
// Per-image multimodal contract
// ---------------------------------------------------------------------------

export const IMAGE_EVIDENCE_CONTEXT_VERSION = "1.0" as const;

/**
 * One uploaded image together with the project it is linked to. Returned by
 * GET /api/cvs/{id}/image-context and by getImageEvidenceForCv().
 *
 * When `confirmation.isConfirmed` is true, the user has confirmed that the
 * description and the project link are accurate for exactly the file and the
 * project text included here. Any later change resets the status.
 */
export interface ImageEvidenceContext {
  contractVersion: typeof IMAGE_EVIDENCE_CONTEXT_VERSION;
  imageId: string;
  cvProfileId: string;
  projectId: string | null;
  kind: ImageKind;
  resource: {
    /** Relative URL serving the file; prefix with the app origin. */
    url: string;
    mimeType: string;
    originalFileName: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    sha256: string | null;
    available: boolean;
  };
  description: {
    altText: string;
    caption: string | null;
    source: "USER_PROVIDED";
  };
  provenance: ImageProvenance;
  confirmation: ImageConfirmation;
  /** The linked project as currently saved, or null if the image is not linked. */
  project: {
    id: string;
    name: string;
    role: string | null;
    technologies: string | null;
    url: string | null;
    description: string;
  } | null;
}
