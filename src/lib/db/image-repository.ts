import { PipelineError } from "@/lib/ai/errors";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  computeImageFingerprint,
  imageConfirmation,
  imageUrl,
  toImageEvidenceContext,
} from "@/lib/integration/image-evidence";
import type { InspectedImage } from "@/lib/storage/image-inspection";
import { deleteImageFilesBestEffort, imageFileExists, saveImageFile, sha256Hex } from "@/lib/storage/image-storage";
import {
  MAX_IMAGES_PER_CV,
  MAX_IMAGES_PER_PROJECT,
  type ImageKind,
  type ImageMetadataInput,
  type ImageUpdateInput,
} from "@/lib/validation/image-schema";
import type { CvImageDto } from "@/types/cv";
import type { ImageEvidenceContext } from "@/types/integration";

/**
 * All CV image database access. Every operation on an existing image is
 * scoped by BOTH the CV id and the image id, so an image can never be read,
 * changed or linked through a different CV than the one it belongs to.
 */

/** A rule violation the user can fix (bad project link, limit reached, …). */
export class ImageRuleError extends Error {
  constructor(
    readonly field: "file" | "projectId",
    message: string,
  ) {
    super(message);
  }
}

export const imageInclude = {
  project: {
    select: { id: true, name: true, role: true, url: true, technologies: true, description: true },
  },
} satisfies Prisma.CvImageInclude;

export type ImageWithProject = Prisma.CvImageGetPayload<{ include: typeof imageInclude }>;

export function toImageDto(image: ImageWithProject): CvImageDto {
  const confirmation = imageConfirmation(image);
  return {
    id: image.id,
    reviewFingerprint: computeImageFingerprint(image),
    cvProfileId: image.cvProfileId,
    projectId: image.projectId,
    kind: image.kind as ImageKind,
    originalName: image.originalName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    sha256: image.sha256,
    altText: image.altText,
    caption: image.caption ?? "",
    url: imageUrl(image),
    confirmationStatus: confirmation.status,
    confirmedAt: confirmation.confirmedAt,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function findForCv(cvProfileId: string, imageId: string) {
  return prisma.cvImage.findFirst({ where: { id: imageId, cvProfileId }, include: imageInclude });
}

export async function listImagesForCv(cvProfileId: string): Promise<CvImageDto[]> {
  const images = await prisma.cvImage.findMany({
    where: { cvProfileId },
    include: imageInclude,
    orderBy: { createdAt: "asc" },
  });
  return images.map(toImageDto);
}

/** Used only by the file-serving route, which looks images up by id. */
export function findImageRecord(imageId: string) {
  return prisma.cvImage.findUnique({ where: { id: imageId } });
}

export async function getImageForCv(cvProfileId: string, imageId: string): Promise<CvImageDto | null> {
  const image = await findForCv(cvProfileId, imageId);
  return image ? toImageDto(image) : null;
}

/** Ids of this CV's images whose files are missing from storage. */
export async function findMissingImageFiles(images: { id: string; storedFileName: string }[]) {
  const checks = await Promise.all(
    images.map(async (image) => ((await imageFileExists(image.storedFileName)) ? null : image.id)),
  );
  return new Set(checks.filter((id): id is string => id !== null));
}

/** The per-image multimodal contract for every image of a CV. */
export async function getImageEvidenceForCv(
  cvProfileId: string,
  options: { confirmedOnly?: boolean; projectId?: string } = {},
): Promise<ImageEvidenceContext[]> {
  const images = await prisma.cvImage.findMany({
    where: { cvProfileId, ...(options.projectId ? { projectId: options.projectId } : {}) },
    include: imageInclude,
    orderBy: { createdAt: "asc" },
  });
  const missing = await findMissingImageFiles(images);
  const contexts = images.map((image) => toImageEvidenceContext(image, !missing.has(image.id)));
  return options.confirmedOnly ? contexts.filter((c) => c.confirmation.isConfirmed) : contexts;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

async function assertProjectBelongsToCv(cvProfileId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, cvProfileId }, select: { id: true } });
  if (!project) {
    throw new ImageRuleError("projectId", "The selected project does not belong to this CV. Save the CV and try again.");
  }
}

async function assertProjectHasRoom(projectId: string, excludeImageId?: string) {
  const count = await prisma.cvImage.count({
    where: { projectId, ...(excludeImageId ? { id: { not: excludeImageId } } : {}) },
  });
  if (count >= MAX_IMAGES_PER_PROJECT) {
    throw new ImageRuleError(
      "projectId",
      `A project can have at most ${MAX_IMAGES_PER_PROJECT} images. Delete one before adding another.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Writes the file to disk, then records its metadata. If the database insert
 * fails, the orphaned file is removed again.
 */
export async function createImage(params: {
  cvProfileId: string;
  metadata: ImageMetadataInput;
  bytes: Uint8Array;
  inspected: InspectedImage;
  originalName: string;
}): Promise<CvImageDto> {
  const { cvProfileId, metadata, bytes, inspected, originalName } = params;

  if ((await prisma.cvImage.count({ where: { cvProfileId } })) >= MAX_IMAGES_PER_CV) {
    throw new ImageRuleError("file", `A CV can have at most ${MAX_IMAGES_PER_CV} images. Delete one first.`);
  }
  if (metadata.projectId) {
    await assertProjectBelongsToCv(cvProfileId, metadata.projectId);
    await assertProjectHasRoom(metadata.projectId);
  }

  const storedFileName = await saveImageFile(bytes, inspected.extension);
  try {
    const image = await prisma.cvImage.create({
      data: {
        cvProfileId,
        projectId: metadata.projectId || null,
        kind: metadata.kind,
        storedFileName,
        originalName: originalName.slice(0, 255),
        mimeType: inspected.mimeType,
        sizeBytes: bytes.byteLength,
        width: inspected.width,
        height: inspected.height,
        sha256: sha256Hex(bytes),
        altText: metadata.altText,
        caption: metadata.caption || null,
      },
      include: imageInclude,
    });
    return toImageDto(image);
  } catch (error) {
    await deleteImageFilesBestEffort([storedFileName]);
    throw error;
  }
}

/**
 * Updates an image's description, kind or project link, and/or records the
 * user's confirmation. Returns null if the image does not belong to the CV.
 */
export async function updateImage(
  cvProfileId: string,
  imageId: string,
  input: ImageUpdateInput,
): Promise<CvImageDto | null> {
  return prisma.$transaction(async tx=>{
    const existing=await tx.cvImage.findFirst({where:{id:imageId,cvProfileId},include:imageInclude});
    if(!existing)return null;
    const hasEdits=["kind","altText","caption","projectId"].some(key=>input[key as keyof ImageUpdateInput]!==undefined);
    if(input.confirmed && (hasEdits || !input.expectedFingerprint || input.expectedFingerprint!==computeImageFingerprint(existing)))
      throw new PipelineError(409,"STALE_IMAGE_REVIEW","Reload and review the current image before confirming. Save edits separately, then confirm the saved version.");
    const newProjectId=input.projectId===undefined?undefined:input.projectId||null;
    if(newProjectId && newProjectId!==existing.projectId){
      const project=await tx.project.findFirst({where:{id:newProjectId,cvProfileId}});
      if(!project)throw new ImageRuleError("projectId","The selected project does not belong to this CV.");
      const count=await tx.cvImage.count({where:{projectId:newProjectId,id:{not:imageId}}});
      if(count>=MAX_IMAGES_PER_PROJECT)throw new ImageRuleError("projectId","A project can have at most 6 images. Remove one before adding another.");
    }
    const image=await tx.cvImage.update({where:{id:imageId},data:{
      kind:input.kind,altText:input.altText,caption:input.caption===undefined?undefined:input.caption||null,projectId:newProjectId,
      ...(input.confirmed===undefined?{}:input.confirmed?{confirmedAt:new Date(),confirmedHash:computeImageFingerprint(existing)}:{confirmedAt:null,confirmedHash:null}),
    },include:imageInclude});
    return toImageDto(image);
  },{timeout:10000});
}

/**
 * Replaces an image's file while keeping its id, description and project link.
 * The new file is written first; the old one is only removed once the database
 * points at the new one. A previous confirmation becomes stale automatically
 * (the file hash changes), unless the identical file was uploaded again.
 */
export async function replaceImageFile(params: {
  cvProfileId: string;
  imageId: string;
  bytes: Uint8Array;
  inspected: InspectedImage;
  originalName: string;
}): Promise<CvImageDto | null> {
  const { cvProfileId, imageId, bytes, inspected, originalName } = params;
  const existing = await findForCv(cvProfileId, imageId);
  if (!existing) return null;

  const storedFileName = await saveImageFile(bytes, inspected.extension);
  let image: ImageWithProject;
  try {
    image = await prisma.cvImage.update({
      where: { id: imageId },
      data: {
        storedFileName,
        originalName: originalName.slice(0, 255),
        mimeType: inspected.mimeType,
        sizeBytes: bytes.byteLength,
        width: inspected.width,
        height: inspected.height,
        sha256: sha256Hex(bytes),
      },
      include: imageInclude,
    });
  } catch (error) {
    await deleteImageFilesBestEffort([storedFileName]);
    throw error;
  }
  await deleteImageFilesBestEffort([existing.storedFileName]);
  return toImageDto(image);
}

/**
 * Deletes an image record and its file. The image must belong to the given
 * CV. Returns false when there is nothing to delete.
 */
export async function deleteImage(cvProfileId: string, imageId: string): Promise<boolean> {
  const image = await prisma.cvImage.findFirst({ where: { id: imageId, cvProfileId } });
  if (!image) return false;
  await prisma.cvImage.delete({ where: { id: imageId } });
  await deleteImageFilesBestEffort([image.storedFileName]);
  return true;
}
