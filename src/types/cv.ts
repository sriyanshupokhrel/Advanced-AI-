/**
 * Shared CV types used by the UI, the API routes and (later) other team
 * members' modules. These describe the JSON returned by the CV API.
 *
 * Optional text fields are "" (never null) when the user left them blank.
 */
import type {
  AchievementInput,
  CvInput,
  EducationInput,
  ExperienceInput,
  FieldErrors,
  ProjectInput,
  SkillInput,
} from "@/lib/validation/cv-schema";
import type { ImageKind } from "@/lib/validation/image-schema";
import type { ReadinessIssue } from "@/types/integration";
import type { ConfirmationStatus } from "@/types/job";

export type {
  AchievementInput,
  CvInput,
  EducationInput,
  ExperienceInput,
  FieldErrors,
  ImageKind,
  ProjectInput,
  SkillInput,
};

type WithId<T> = Omit<T, "id"> & { id: string };

export interface CvImageDto {
  reviewFingerprint: string;
  id: string;
  cvProfileId: string;
  projectId: string | null;
  kind: ImageKind;
  originalName: string;
  /** Validated from the file content, not from the file name. */
  mimeType: string;
  sizeBytes: number;
  /** Null only for images uploaded before dimensions were recorded. */
  width: number | null;
  height: number | null;
  sha256: string | null;
  altText: string;
  caption: string;
  /**
   * Relative URL that serves the image file, e.g. /api/images/{id}?v=abc123.
   * The `v` parameter changes when the file is replaced, so browsers never
   * show a stale cached copy.
   */
  url: string;
  /** The user's confirmation of the description and project link. */
  confirmationStatus: ConfirmationStatus;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A complete, saved CV as returned by GET /api/cvs/{id}. */
export interface CvProfileDto
  extends Omit<CvInput, "education" | "experience" | "skills" | "projects" | "achievements"> {
  id: string;
  createdAt: string;
  updatedAt: string;
  education: WithId<EducationInput>[];
  experience: WithId<ExperienceInput>[];
  skills: WithId<SkillInput>[];
  projects: WithId<ProjectInput>[];
  achievements: WithId<AchievementInput>[];
  images: CvImageDto[];
}

/** Lightweight row for the CV list, as returned by GET /api/cvs. */
export interface CvSummaryDto {
  id: string;
  fullName: string;
  headline: string;
  updatedAt: string;
}

/** Body of every non-2xx JSON response from the API. */
export interface ApiErrorBody {
  error: string;
  fieldErrors?: FieldErrors;
  /** Present on 409 "not ready" responses from the integration payload endpoint. */
  issues?: ReadinessIssue[];
}
