import type { ApiErrorBody } from "@/types/cv";
import type { InterviewPreparationPayload, ReadinessIssue } from "@/types/integration";
import {
  ImageAnalysisResultSchema,
  InterviewGenerationResponseSchema,
  type InterviewGenerationResponse,
  type SavedPresentationRecord,
} from "@/types/interview-generation";
import { buildEvidenceMap, buildImageMap, hasSamePresentationReferences } from "@/lib/presentation/editor-model";
import { InterviewPresentationSchema, PresentationDraftSchema } from "@/types/presentation";

export { contextSnapshotKey } from "@/lib/presentation/source-snapshot";

export type ContextFailure =
  | { kind: "NOT_FOUND"; message: string }
  | { kind: "NOT_READY"; message: string; issues: ReadinessIssue[] }
  | { kind: "ERROR"; message: string };

export interface AcceptedGeneration {
  response: InterviewGenerationResponse;
  draft: InterviewGenerationResponse["presentation"];
  sourceSnapshot: InterviewPreparationPayload;
  stale: SavedPresentationRecord["stale"];
  referenceWarnings: string[];
}

export interface GenerationUiState {
  phase: "IDLE" | "GENERATING";
  activeRequestId: number | null;
  accepted: AcceptedGeneration | null;
  error: string | null;
}

export type GenerationUiAction =
  | { type: "BEGIN"; requestId: number }
  | { type: "SUCCESS"; requestId: number; accepted: AcceptedGeneration }
  | { type: "FAILURE"; requestId: number; message: string }
  | { type: "LOAD"; accepted: AcceptedGeneration }
  | { type: "RESET" };

export const initialGenerationState: GenerationUiState = {
  phase: "IDLE",
  activeRequestId: null,
  accepted: null,
  error: null,
};

/** Stale completions are ignored, and failures deliberately retain the last usable draft. */
export function generationReducer(state: GenerationUiState, action: GenerationUiAction): GenerationUiState {
  if (action.type === "RESET") return initialGenerationState;
  if (action.type === "LOAD") return { phase: "IDLE", activeRequestId: null, accepted: action.accepted, error: null };
  if (action.type === "BEGIN") {
    if (state.activeRequestId !== null) return state;
    return { ...state, phase: "GENERATING", activeRequestId: action.requestId, error: null };
  }
  if (state.activeRequestId !== action.requestId) return state;
  if (action.type === "SUCCESS") {
    return { phase: "IDLE", activeRequestId: null, accepted: action.accepted, error: null };
  }
  return { ...state, phase: "IDLE", activeRequestId: null, error: action.message };
}

export function classifyContextFailure(status: number, error: ApiErrorBody): ContextFailure {
  if (status === 404) return { kind: "NOT_FOUND", message: error.error || "CV–job target not found." };
  if (status === 409) {
    return {
      kind: "NOT_READY",
      message: error.error || "The confirmed information is not ready yet.",
      issues: Array.isArray(error.issues) ? error.issues : [],
    };
  }
  return { kind: "ERROR", message: error.error || "Unable to load the confirmed information." };
}

export function isReadyContextForTarget(value: unknown, targetId: string): value is InterviewPreparationPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<InterviewPreparationPayload>;
  return Boolean(
    payload.contractVersion === "2.0" &&
    payload.targetId === targetId &&
    payload.readiness?.status === "READY" &&
    payload.readiness?.isReady === true &&
    payload.candidate?.profile?.fullName &&
    Array.isArray(payload.candidate?.skills?.items) &&
    Array.isArray(payload.candidate?.workExperience?.items) &&
    Array.isArray(payload.candidate?.projects?.items) &&
    Array.isArray(payload.candidate?.education?.items) &&
    typeof payload.targetJob?.descriptionText === "string" &&
    typeof payload.verificationDisclaimer === "string"
  );
}

export function validateGenerationResponse(
  value: unknown,
  targetId: string,
  context: InterviewPreparationPayload,
): { ok: true; value: AcceptedGeneration } | { ok: false; error: string } {
  const parsed = InterviewGenerationResponseSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "The generation service returned an invalid response." };
  if (parsed.data.targetId !== targetId || context.targetId !== targetId) {
    return { ok: false, error: "The generated presentation belongs to a different target." };
  }

  const contextImages = buildImageMap(context);
  const analyses = new Map<string, (typeof parsed.data.imageAnalyses)[number]>();
  for (const analysis of parsed.data.imageAnalyses) {
    if (analyses.has(analysis.imageId)) {
      return { ok: false, error: `The generation response repeated image analysis ${analysis.imageId}.` };
    }
    if (!contextImages.has(analysis.imageId)) {
      return { ok: false, error: `The generation response referenced an image outside this target: ${analysis.imageId}.` };
    }
    analyses.set(analysis.imageId, analysis);
  }

  for (const slide of parsed.data.presentation.slides) {
    for (const imageId of slide.imageIds) {
      if (!contextImages.has(imageId) || !analyses.has(imageId)) {
        return { ok: false, error: `The presentation image does not match this generation context: ${imageId}.` };
      }
    }
  }

  const evidence = buildEvidenceMap(context);
  const unknownSources = new Set(
    parsed.data.presentation.slides.flatMap((slide) => slide.sourceIds).filter((id) => !evidence.has(id)),
  );
  return {
    ok: true,
    value: {
      response: parsed.data,
      draft: parsed.data.presentation,
      sourceSnapshot: context,
      stale: { isStale: false, reasons: [], unavailableImageIds: [] },
      referenceWarnings: [...unknownSources].map((id) => `Unknown source reference: ${id}`),
    },
  };
}

export function validateSavedPresentationRecord(
  value: unknown,
  targetId: string,
): { ok: true; value: AcceptedGeneration } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "The saved presentation response was invalid." };
  const record = value as Partial<SavedPresentationRecord>;
  const original = InterviewPresentationSchema.safeParse(record.original);
  const draft = PresentationDraftSchema.safeParse(record.draft);
  const analyses = ImageAnalysisResultSchema.array().safeParse(record.imageAnalyses);
  const source = record.sourceSnapshot;
  const stale = record.stale;
  if (
    typeof record.id !== "string" || !record.id || record.targetId !== targetId ||
    typeof record.revision !== "number" || !Number.isInteger(record.revision) || record.revision < 1 ||
    typeof record.generatedAt !== "string" || typeof record.updatedAt !== "string" ||
    typeof record.sourceFingerprint !== "string" ||
    !original.success || !draft.success || !analyses.success ||
    !isReadyContextForTarget(source, targetId) ||
    !stale || typeof stale.isStale !== "boolean" || !Array.isArray(stale.reasons) || !Array.isArray(stale.unavailableImageIds) ||
    !hasSamePresentationReferences(original.data, draft.data)
  ) return { ok: false, error: "The saved presentation response was invalid." };

  const response = InterviewGenerationResponseSchema.safeParse({
    targetId,
    presentationId: record.id,
    revision: record.revision,
    imageAnalyses: analyses.data,
    presentation: original.data,
    generatedAt: record.generatedAt,
    updatedAt: record.updatedAt,
  });
  if (!response.success) return { ok: false, error: "The saved presentation response was invalid." };
  const checked = validateGenerationResponse(response.data, targetId, source);
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: {
      ...checked.value,
      draft: draft.data,
      sourceSnapshot: source,
      stale: {
        isStale: stale.isStale,
        reasons: stale.reasons.filter((reason): reason is string => typeof reason === "string"),
        unavailableImageIds: stale.unavailableImageIds.filter((id): id is string => typeof id === "string"),
      },
    },
  };
}
