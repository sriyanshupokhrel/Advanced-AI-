import { findImageRecord } from "@/lib/db/image-repository";
import { getPresentationExportRecord, PresentationReferenceError } from "@/lib/db/presentation-repository";
import { buildEvidenceMap, buildImageMap } from "@/lib/presentation/editor-model";
import { readImageFile, sha256Hex } from "@/lib/storage/image-storage";
import { decodeImage } from "@/lib/storage/image-decode";
import sharp from "sharp";
import type { InterviewPreparationPayload, PayloadImage } from "@/types/integration";
import {
  inspectPptxFit,
  type PresentationExportSnapshot,
  type VerifiedExportImage,
} from "./pptx-builder";

export { buildPresentationPptx, inspectPptxFit, presentationDownloadFileName } from "./pptx-builder";
export type { PresentationExportSnapshot, VerifiedExportImage } from "./pptx-builder";

export const PRESENTATION_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export class PresentationExportValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join(" "));
    this.issues = issues;
  }
}

function referencedIds(presentation: PresentationExportSnapshot["draft"], key: "sourceIds" | "imageIds") {
  return [...new Set(presentation.slides.flatMap((slide) => slide[key]))];
}

function snapshotProjectId(payload: InterviewPreparationPayload, imageId: string) {
  return payload.candidate.projects.items.find((project) => project.images.some((image) => image.imageId === imageId))?.id ?? null;
}

async function verifyImage(imageId: string, image: PayloadImage, snapshot: InterviewPreparationPayload): Promise<VerifiedExportImage> {
  if (!image.fileAvailable || !image.sha256 || !image.width || !image.height) throw new PresentationReferenceError(`Image ${imageId} is missing a usable file, SHA-256 or dimensions.`);
  if (!SUPPORTED_IMAGE_TYPES.has(image.mimeType)) {
    throw new PresentationReferenceError(image.mimeType === "image/webp"
      ? `Image ${imageId} is WebP. Convert it to PNG or JPEG, upload and confirm it again before export.`
      : `Image ${imageId} uses unsupported format ${image.mimeType}.`);
  }
  const record = await findImageRecord(imageId);
  if (!record || record.cvProfileId !== snapshot.candidate.cvProfileId || record.projectId !== snapshotProjectId(snapshot, imageId)) {
    throw new PresentationReferenceError(`Image ${imageId} no longer belongs to the saved CV and project snapshot.`);
  }
  if (record.sha256 !== image.sha256 || record.mimeType !== image.mimeType || record.width !== image.width || record.height !== image.height) {
    throw new PresentationReferenceError(`Image ${imageId} metadata changed after this presentation was generated.`);
  }
  const bytes = await readImageFile(record.storedFileName);
  if (!bytes) throw new PresentationReferenceError(`Image ${imageId} is missing from upload storage.`);
  if (sha256Hex(bytes) !== image.sha256) throw new PresentationReferenceError(`Image ${imageId} bytes do not match the saved SHA-256.`);
  const decoded = await decodeImage(bytes);
  if (!decoded.ok || decoded.image.mimeType !== image.mimeType) throw new PresentationReferenceError(`Image ${imageId} cannot be fully decoded as its saved format.`);
  if (image.mimeType === "image/webp") {
    const png = await sharp(bytes).png().toBuffer({ resolveWithObject: true });
    return { imageId, mimeType: "image/png", width: png.info.width, height: png.info.height, altText: image.description.altText, caption: image.description.caption, bytes: png.data };
  }
  return { imageId, mimeType: image.mimeType as VerifiedExportImage["mimeType"], width: image.width, height: image.height, altText: image.description.altText, caption: image.description.caption, bytes };
}

export async function preparePresentationExport(input: { targetId: string; presentationId: string; expectedRevision: number }): Promise<PresentationExportSnapshot | null> {
  const loaded = await getPresentationExportRecord(input);
  if (!loaded) return null;
  const sourceMap = buildEvidenceMap(loaded.record.sourceSnapshot);
  const imageMap = buildImageMap(loaded.record.sourceSnapshot);
  const missingSources = referencedIds(loaded.draft, "sourceIds").filter((id) => !sourceMap.has(id));
  const missingImages = referencedIds(loaded.draft, "imageIds").filter((id) => !imageMap.has(id));
  if (missingSources.length || missingImages.length) {
    throw new PresentationReferenceError([missingSources.length ? `Unknown source IDs: ${missingSources.join(", ")}.` : "", missingImages.length ? `Unknown image IDs: ${missingImages.join(", ")}.` : ""].filter(Boolean).join(" "));
  }
  const fitIssues = inspectPptxFit(loaded.draft);
  if (fitIssues.length) throw new PresentationExportValidationError(fitIssues.map((issue) => issue.message));
  const images = new Map<string, VerifiedExportImage>();
  for (const imageId of referencedIds(loaded.draft, "imageIds")) {
    const resolved = imageMap.get(imageId);
    if (resolved) images.set(imageId, await verifyImage(imageId, resolved.image, loaded.record.sourceSnapshot));
  }
  return { presentationId: loaded.record.id, targetId: loaded.record.targetId, revision: loaded.record.revision, draft: loaded.draft, sourceSnapshot: loaded.record.sourceSnapshot, images, reliability: loaded.record.reliability };
}
