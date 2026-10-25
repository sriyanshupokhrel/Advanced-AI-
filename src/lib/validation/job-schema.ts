import { z } from "zod";

/**
 * Validation for a target job description. Shared by the browser form and the
 * API routes.
 *
 * The description itself is deliberately NOT trimmed or otherwise transformed:
 * it is stored exactly as pasted so its meaning (and formatting such as
 * bullet points and line breaks) is preserved for later processing. Length
 * rules are measured on the trimmed text so whitespace cannot satisfy them.
 */

export const JOB_DESCRIPTION_MIN_CHARS = 50;
export const JOB_DESCRIPTION_MAX_CHARS = 30000;

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

export const jobDescriptionSchema = z.object({
  title: optionalText("Job title", 150),
  companyName: optionalText("Company name", 150),
  companyInfo: optionalText("Company information", 2000),
  jobReference: optionalText("Job reference", 100),
  description: z
    .string("Paste the job description.")
    .refine((value) => value.trim().length > 0, "Paste the job description.")
    .refine(
      (value) => value.trim().length === 0 || value.trim().length >= JOB_DESCRIPTION_MIN_CHARS,
      `The job description looks too short. Paste the full advert (at least ${JOB_DESCRIPTION_MIN_CHARS} characters).`,
    )
    .refine(
      (value) => value.length <= JOB_DESCRIPTION_MAX_CHARS,
      `The job description must be ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-AU")} characters or fewer.`,
    ),
});

export type JobDescriptionInput = z.output<typeof jobDescriptionSchema>;

/** Body of POST /api/targets. */
export const cvJobTargetSchema = z.object({
  cvProfileId: z.string("Select a CV.").trim().min(1, "Select a CV.").max(64),
  jobDescriptionId: z.string("Select a job description.").trim().min(1, "Select a job description.").max(64),
});

/** The parts of a CV–job pair the user reviews and confirms one by one. */
export const REVIEW_SECTIONS = [
  "PROFILE",
  "EDUCATION",
  "EXPERIENCE",
  "SKILLS",
  "PROJECTS",
  "ACHIEVEMENTS",
  "TARGET_JOB",
] as const;

export type ReviewSection = (typeof REVIEW_SECTIONS)[number];

export const REVIEW_SECTION_LABELS: Record<ReviewSection, string> = {
  PROFILE: "Personal details & summary",
  EDUCATION: "Education",
  EXPERIENCE: "Work experience",
  SKILLS: "Skills",
  PROJECTS: "Projects",
  ACHIEVEMENTS: "Achievements",
  TARGET_JOB: "Target job",
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Body of PATCH /api/targets/{id}.
 *
 * - `confirmed`: true to confirm, false to withdraw confirmation.
 * - `sections`: which sections to change; omitted means all seven.
 * - `expectedFingerprints`: required when confirming each selected section; the fingerprint the user
 *   was shown. If the stored data has changed since (e.g. edited in another
 *   tab), the request is refused with 409 instead of confirming content the
 *   user never saw.
 */
export const targetConfirmationSchema = z.object({
  confirmed: z.boolean("`confirmed` must be true or false."),
  sections: z
    .array(z.enum(REVIEW_SECTIONS, `Each section must be one of: ${REVIEW_SECTIONS.join(", ")}.`))
    .min(1, "List at least one section, or omit `sections` to change all of them.")
    .optional(),
  expectedFingerprints: z
    .partialRecord(z.enum(REVIEW_SECTIONS), z.string().regex(SHA256_HEX, "Fingerprints are 64-character SHA-256 hex strings."))
    .optional(),
});

export type TargetConfirmationInput = z.output<typeof targetConfirmationSchema>;
