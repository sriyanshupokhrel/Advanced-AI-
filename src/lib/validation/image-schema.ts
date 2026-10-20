import { z } from "zod";

export const IMAGE_KINDS = [
  "PROFILE_PHOTO",
  "PROJECT_SCREENSHOT",
  "CERTIFICATE",
  "OTHER",
] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_KIND_LABELS: Record<ImageKind, string> = {
  PROFILE_PHOTO: "Profile photo",
  PROJECT_SCREENSHOT: "Project screenshot",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Upload limits (enforced on the server; mirrored in the browser for feedback)
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PROJECT = 6;
export const MAX_IMAGES_PER_CV = 40;
/** Longest allowed side, in pixels. */
export const MAX_IMAGE_DIMENSION = 10_000;
/** Guards against "decompression bomb" images that are tiny on disk but huge in memory. */
export const MAX_IMAGE_PIXELS = 40_000_000;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const ALLOWED_IMAGE_LABEL = "PNG, JPEG, WebP or GIF";

// ---------------------------------------------------------------------------
// Text fields
// ---------------------------------------------------------------------------

const altText = z
  .string()
  .trim()
  .min(1, "Describe the image in a few words (a description is required).")
  .max(200, "Description must be 200 characters or fewer.");
const caption = z.string().trim().max(300, "Caption must be 300 characters or fewer.");
const projectId = z.string().trim().max(64);
const kind = z.enum(IMAGE_KINDS, "Choose what kind of image this is.");

/** Text fields sent alongside an uploaded image (multipart form fields). */
export const imageMetadataSchema = z.object({
  kind,
  // The description is required: it keeps the CV accessible and is the
  // user's own statement of what the image shows (no AI captioning is used).
  altText,
  caption,
  projectId,
});

export type ImageMetadataInput = z.output<typeof imageMetadataSchema>;

/**
 * PATCH body for an existing image. Every field is optional; `projectId: ""`
 * unlinks the image from its project. `confirmed` applies to the image as it
 * will be after the other changes in the same request.
 */
export const imageUpdateSchema = z
  .object({
    kind: kind.optional(),
    altText: altText.optional(),
    caption: caption.optional(),
    projectId: projectId.optional(),
    confirmed: z.boolean("`confirmed` must be true or false.").optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update.",
    path: ["_form"],
  });

export type ImageUpdateInput = z.output<typeof imageUpdateSchema>;
