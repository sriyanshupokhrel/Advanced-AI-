import type { InterviewPreparationPayload, PayloadImage } from "@/types/integration";

export function snapshotImages(payload: InterviewPreparationPayload) {
  return [
    ...payload.candidate.projects.items.flatMap((project) =>
      project.images.map((image) => ({ projectId: project.id, image })),
    ),
    ...payload.candidate.otherImages.map((image) => ({ projectId: null, image })),
  ];
}

const stableImage = ({ projectId, image }: { projectId: string | null; image: PayloadImage }) => ({
  imageId: image.imageId,
  projectId,
  kind: image.kind,
  sha256: image.sha256,
  fileAvailable: image.fileAvailable,
  altText: image.description.altText,
  caption: image.description.caption,
  confirmationStatus: image.confirmation.status,
});

/** Stable confirmed content only; request-time and ordinary update timestamps are excluded. */
export function contextSnapshotKey(payload: InterviewPreparationPayload): string {
  return JSON.stringify({
    targetId: payload.targetId,
    fingerprints: payload.fingerprints,
    images: snapshotImages(payload).map(stableImage).sort((a, b) => a.imageId.localeCompare(b.imageId)),
  });
}

export interface PresentationStaleStatus {
  isStale: boolean;
  reasons: string[];
  unavailableImageIds: string[];
}

export function compareSourceSnapshot(
  stored: InterviewPreparationPayload,
  current: InterviewPreparationPayload,
): PresentationStaleStatus {
  const reasons: string[] = [];
  const unavailable = new Set<string>();
  if (Object.keys(stored.fingerprints).some((key) =>
    stored.fingerprints[key as keyof typeof stored.fingerprints] !== current.fingerprints[key as keyof typeof current.fingerprints])) {
    reasons.push("The confirmed CV or target job content has changed since this presentation was generated.");
  }

  const currentImages = new Map(snapshotImages(current).map(({ image }) => [image.imageId, image]));
  for (const { image } of snapshotImages(stored)) {
    const latest = currentImages.get(image.imageId);
    if (!latest) {
      unavailable.add(image.imageId);
      reasons.push(`Source image ${image.imageId} is no longer available.`);
    } else if (!latest.fileAvailable || latest.sha256 !== image.sha256) {
      unavailable.add(image.imageId);
      reasons.push(`Source image ${image.imageId} was replaced, changed or is unavailable.`);
    } else if (
      latest.description.altText !== image.description.altText ||
      latest.description.caption !== image.description.caption ||
      latest.confirmation.status !== image.confirmation.status
    ) {
      reasons.push(`Source image ${image.imageId} metadata or confirmation changed.`);
    }
  }
  if (contextSnapshotKey(stored) !== contextSnapshotKey(current) && reasons.length === 0) {
    reasons.push("The confirmed source information has changed since generation.");
  }
  return { isStale: reasons.length > 0, reasons: [...new Set(reasons)], unavailableImageIds: [...unavailable] };
}
