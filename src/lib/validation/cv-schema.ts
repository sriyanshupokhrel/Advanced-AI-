import { z } from "zod";

/**
 * Validation rules for a CV. The same schema runs in the browser (instant
 * feedback) and in the API routes (the authoritative check), so the two can
 * never disagree.
 *
 * Optional text fields use "" for "not provided"; the repository converts ""
 * to NULL when writing to the database.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PHONE_PATTERN = /^[+()\d\s.-]{6,25}$/;

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

const optionalMonth = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || MONTH_PATTERN.test(value),
      `${label} must be a month in YYYY-MM format.`,
    );

const requiredMonth = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .regex(MONTH_PATTERN, `${label} must be a month in YYYY-MM format.`);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Only http(s) links are accepted so stored URLs are always safe to render as
// <a href> (blocks javascript: and data: URLs).
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, `${label} must be 300 characters or fewer.`)
    .refine(
      (value) => value === "" || isHttpUrl(value),
      `${label} must be a full web address starting with http:// or https://.`,
    );

// Database id of an existing item. Omitted for items the user has just added.
const itemId = z.string().trim().min(1).max(64).optional();

function checkDateOrder(
  item: { startDate: string; endDate: string },
  ctx: z.RefinementCtx,
) {
  if (item.startDate && item.endDate && item.endDate < item.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be before the start date.",
    });
  }
}

export const educationSchema = z
  .object({
    id: itemId,
    institution: requiredText("Institution", 150),
    degree: requiredText("Degree or qualification", 150),
    fieldOfStudy: optionalText("Field of study", 150),
    startDate: optionalMonth("Start date"),
    endDate: optionalMonth("End date"),
    grade: optionalText("Grade", 50),
    description: optionalText("Description", 1000),
  })
  .superRefine(checkDateOrder);

export const experienceSchema = z
  .object({
    id: itemId,
    employer: requiredText("Employer", 150),
    role: requiredText("Job title", 150),
    location: optionalText("Location", 100),
    startDate: requiredMonth("Start date"),
    endDate: optionalMonth("End date"),
    isCurrent: z.boolean(),
    description: optionalText("Description", 2000),
  })
  .superRefine((item, ctx) => {
    if (item.isCurrent && item.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Leave the end date empty for your current role.",
      });
    }
    if (!item.isCurrent && !item.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date is required unless this is your current role.",
      });
    }
    checkDateOrder(item, ctx);
  });

export const skillSchema = z.object({
  id: itemId,
  name: requiredText("Skill", 80),
  category: optionalText("Category", 80),
});

export const projectSchema = z.object({
  id: itemId,
  name: requiredText("Project name", 150),
  role: optionalText("Your role", 100),
  url: optionalUrl("Project link"),
  technologies: optionalText("Technologies", 300),
  description: requiredText("Project description", 2000),
});

export const achievementSchema = z.object({
  id: itemId,
  title: requiredText("Achievement title", 150),
  issuer: optionalText("Issuer", 150),
  date: optionalMonth("Date"),
  description: optionalText("Description", 1000),
});

export const cvSchema = z.object({
  fullName: requiredText("Full name", 100),
  headline: optionalText("Headline", 150),
  email: z
    .string()
    .trim()
    .max(254, "Email must be 254 characters or fewer.")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address, e.g. name@example.com.",
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || PHONE_PATTERN.test(value),
      "Phone number may only contain digits, spaces and + ( ) - . (6–25 characters).",
    ),
  location: optionalText("Location", 100),
  website: optionalUrl("Website"),
  summary: requiredText("Professional summary", 2000),
  education: z.array(educationSchema).max(30, "You can add up to 30 education entries."),
  experience: z.array(experienceSchema).max(50, "You can add up to 50 experience entries."),
  skills: z.array(skillSchema).max(100, "You can add up to 100 skills."),
  projects: z.array(projectSchema).max(50, "You can add up to 50 projects."),
  achievements: z.array(achievementSchema).max(50, "You can add up to 50 achievements."),
});

export type CvInput = z.output<typeof cvSchema>;
export type EducationInput = z.output<typeof educationSchema>;
export type ExperienceInput = z.output<typeof experienceSchema>;
export type SkillInput = z.output<typeof skillSchema>;
export type ProjectInput = z.output<typeof projectSchema>;
export type AchievementInput = z.output<typeof achievementSchema>;

/** Validation messages keyed by field path, e.g. "experience.0.role". */
export type FieldErrors = Record<string, string>;

/** Flattens Zod issues to one message per field path (first issue wins). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
