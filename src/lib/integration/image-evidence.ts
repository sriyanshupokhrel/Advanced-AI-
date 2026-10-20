import { createHash } from "node:crypto";
import type { ImageWithProject } from "@/lib/db/image-repository";
import { resolveConfirmationStatus } from "@/lib/integration/interview-payload";
import type { ImageKind } from "@/lib/validation/image-schema";
import {
  IMAGE_EVIDENCE_CONTEXT_VERSION,
  type ImageConfirmation,
  type ImageEvidenceContext,
} from "@/types/integration";

/**
 * Image confirmation and the per-image multimodal contract.
 *
 * Pure data handling: nothing here looks at the pixels or interprets the
 * description. An image is "confirmed" only because the user said its
 * description and project link are accurate.
 */

/**
 * SHA-256 over everything the user confirms about an image: the file itself,
 * its description, its kind, the project it is linked to, and that project's
 * name and description (so rewriting the project also asks for re-confirmation).
 */
export function computeImageFingerprint(image: ImageWithProject): string {
  const payload = {
    // Images uploaded before sha256 was recorded fall back to the unique stored name.
    file: image.sha256 ?? image.storedFileName,
    mimeType: image.mimeType,
    kind: image.kind,
    altText: image.altText,
    caption: image.caption ?? "",
    projectId: image.projectId,
    project: image.project ? { name: image.project.name, description: image.project.description } : null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function imageConfirmation(image: ImageWithProject): ImageConfirmation {
  const status = resolveConfirmationStatus(image.confirmedHash, computeImageFingerprint(image));
  return {
    status,
    confirmedAt: image.confirmedAt?.toISOString() ?? null,
    isConfirmed: status === "CONFIRMED",
  };
}

/** Relative URL for an image; `v` changes whenever the file is replaced. */
export function imageUrl(image: Pick<ImageWithProject, "id" | "sha256" | "storedFileName">): string {
  const version = (image.sha256 ?? image.storedFileName).slice(0, 12);
  return `/api/images/${image.id}?v=${encodeURIComponent(version)}`;
}

export function toImageEvidenceContext(image: ImageWithProject, fileAvailable: boolean): ImageEvidenceContext {
  return {
    contractVersion: IMAGE_EVIDENCE_CONTEXT_VERSION,
    imageId: image.id,
    cvProfileId: image.cvProfileId,
    projectId: image.projectId,
    kind: image.kind as ImageKind,
    resource: {
      url: imageUrl(image),
      mimeType: image.mimeType,
      originalFileName: image.originalName,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      sha256: image.sha256,
      available: fileAvailable,
    },
    description: { altText: image.altText, caption: image.caption, source: "USER_PROVIDED" },
    provenance: "USER_UPLOADED_UNVERIFIED",
    confirmation: imageConfirmation(image),
    project: image.project
      ? {
          id: image.project.id,
          name: image.project.name,
          role: image.project.role,
          technologies: image.project.technologies,
          url: image.project.url,
          description: image.project.description,
        }
      : null,
  };
}
