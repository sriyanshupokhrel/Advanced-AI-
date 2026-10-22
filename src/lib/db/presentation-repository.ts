import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { compareSourceSnapshot, contextSnapshotKey } from "@/lib/presentation/source-snapshot";
import { hasSamePresentationReferences } from "@/lib/presentation/editor-model";
import type { InterviewPreparationPayload } from "@/types/integration";
import {
  ImageAnalysisResultSchema,
  type ImageAnalysisResult,
  type SavedPresentationRecord,
} from "@/types/interview-generation";
import {
  InterviewPresentationSchema,
  PresentationDraftSchema,
  type InterviewPresentation,
} from "@/types/presentation";

export class PresentationSourceChangedError extends Error {}
export class PresentationRevisionConflictError extends Error {}
export class PresentationReferenceError extends Error {}
export class PresentationNotReadyError extends Error {}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parseSourceSnapshot(value: string, targetId: string): InterviewPreparationPayload {
  const parsed = parseJson(value) as Partial<InterviewPreparationPayload>;
  if (parsed.contractVersion !== "2.0" || parsed.targetId !== targetId || !parsed.candidate || !parsed.targetJob) {
    throw new Error("Stored presentation source snapshot is invalid.");
  }
  return parsed as InterviewPreparationPayload;
}

type StoredRecord = Prisma.InterviewPresentationRecordGetPayload<Record<string, never>>;

function decodeRecord(
  record: StoredRecord,
  current: InterviewPreparationPayload,
): SavedPresentationRecord {
  const original = InterviewPresentationSchema.parse(parseJson(record.originalJson));
  const draft = PresentationDraftSchema.parse(parseJson(record.draftJson));
  const imageAnalyses = ImageAnalysisResultSchema.array().parse(parseJson(record.imageAnalysesJson));
  const sourceSnapshot = parseSourceSnapshot(record.sourceSnapshotJson, record.targetId);
  return {
    id: record.id,
    targetId: record.targetId,
    original,
    draft,
    imageAnalyses,
    sourceSnapshot,
    sourceFingerprint: record.sourceFingerprint,
    generatedAt: record.generatedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revision: record.revision,
    stale: compareSourceSnapshot(sourceSnapshot, current),
  };
}

export async function createPresentationRecord(input: {
  targetId: string;
  original: InterviewPresentation;
  imageAnalyses: ImageAnalysisResult[];
  sourceSnapshot: InterviewPreparationPayload;
  generatedAt: string;
}) {
  const original = InterviewPresentationSchema.parse(input.original);
  const analyses = ImageAnalysisResultSchema.array().parse(input.imageAnalyses);
  const expectedFingerprint = contextSnapshotKey(input.sourceSnapshot);
  return prisma.$transaction(async (tx) => {
    const current = await getInterviewPreparationPayload(input.targetId, tx);
    if (!current || !current.readiness.isReady || current.readiness.status !== "READY") {
      throw new PresentationSourceChangedError("Confirmed information is no longer ready.");
    }
    if (contextSnapshotKey(current) !== expectedFingerprint) {
      throw new PresentationSourceChangedError("Confirmed information changed during generation.");
    }
    const record = await tx.interviewPresentationRecord.create({
      data: {
        targetId: input.targetId,
        originalJson: JSON.stringify(original),
        draftJson: JSON.stringify(original),
        imageAnalysesJson: JSON.stringify(analyses),
        sourceSnapshotJson: JSON.stringify(input.sourceSnapshot),
        sourceFingerprint: expectedFingerprint,
        generatedAt: new Date(input.generatedAt),
      },
    });
    return decodeRecord(record, current);
  });
}

export async function getLatestPresentationRecord(targetId: string) {
  const current = await getInterviewPreparationPayload(targetId);
  if (!current) return { targetExists: false as const, record: null };
  const record = await prisma.interviewPresentationRecord.findFirst({
    where: { targetId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return { targetExists: true as const, record: record ? decodeRecord(record, current) : null };
}

export async function savePresentationDraft(input: {
  targetId: string;
  presentationId: string;
  draft: InterviewPresentation;
  expectedRevision: number;
}) {
  const draft = PresentationDraftSchema.parse(input.draft);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interviewPresentationRecord.findUnique({ where: { id: input.presentationId } });
    if (!existing || existing.targetId !== input.targetId) return null;
    const original = InterviewPresentationSchema.parse(parseJson(existing.originalJson));
    if (!hasSamePresentationReferences(original, draft)) {
      throw new PresentationReferenceError("Draft source, image and bullet structure must remain unchanged.");
    }
    if (existing.revision !== input.expectedRevision) {
      throw new PresentationRevisionConflictError("This presentation was saved in another window.");
    }
    const updated = await tx.interviewPresentationRecord.updateMany({
      where: { id: input.presentationId, targetId: input.targetId, revision: input.expectedRevision },
      data: { draftJson: JSON.stringify(draft), revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new PresentationRevisionConflictError("This presentation was saved in another window.");
    const record = await tx.interviewPresentationRecord.findUniqueOrThrow({ where: { id: input.presentationId } });
    const current = await getInterviewPreparationPayload(input.targetId, tx);
    if (!current) return null;
    return decodeRecord(record, current);
  });
}

/**
 * Loads one immutable saved revision for export. The database checks happen in
 * one transaction; image bytes are verified separately against this snapshot.
 */
export async function getPresentationExportRecord(input: {
  targetId: string;
  presentationId: string;
  expectedRevision: number;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interviewPresentationRecord.findUnique({ where: { id: input.presentationId } });
    if (!existing || existing.targetId !== input.targetId) return null;
    if (existing.revision !== input.expectedRevision) {
      throw new PresentationRevisionConflictError("The saved presentation revision changed before export.");
    }

    const current = await getInterviewPreparationPayload(input.targetId, tx);
    if (!current) return null;
    if (!current.readiness.isReady || current.readiness.status !== "READY") {
      throw new PresentationNotReadyError("The current CV, job or image information needs review and confirmation before export.");
    }

    const record = decodeRecord(existing, current);
    if (record.sourceFingerprint !== contextSnapshotKey(record.sourceSnapshot)) {
      throw new PresentationSourceChangedError("The saved source snapshot fingerprint is invalid.");
    }
    if (record.stale.isStale) {
      throw new PresentationSourceChangedError(record.stale.reasons.join(" ") || "The confirmed source information changed after generation.");
    }

    const draft = InterviewPresentationSchema.parse(parseJson(existing.draftJson));
    if (!hasSamePresentationReferences(record.original, draft)) {
      throw new PresentationReferenceError("The saved draft references do not match the generated original.");
    }
    return { record, current, draft };
  });
}
