
import "server-only";

import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import type { ImageAnalysisResult } from "@/types/interview-generation";
import { isIsolatedE2EMockAiEnabled } from "./e2e-mock-guard";

import { runInterviewAIPipeline as runReliabilityPipeline } from "./reliability-pipeline";
import { PipelineError } from "./errors";
import { snapshotToken } from "./snapshot";
import { sourceRegistry } from "./presentation-schema";
import { contextSnapshotKey } from "@/lib/presentation/source-snapshot";
import { toEditorPresentation, toEditorImageAnalyses } from "@/lib/presentation/reliability-adapter";
import { ReliabilityMetadataSchema } from "@/types/reliability";

export async function runInterviewAIPipeline(
  targetId: string,
  expectedSourceFingerprint?: string,
) {
  const payload = await getInterviewPreparationPayload(targetId);

  if (!payload) {
    throw new PipelineError(404, "TARGET_NOT_FOUND", "CV–job pairing not found.");
  }

  if (
    !payload.readiness.isReady ||
    payload.readiness.status !== "READY"
  ) {
    throw new PipelineError(409, "NOT_CONFIRMED", "Review and confirm all sections and images before generation.");
  }

  if (!expectedSourceFingerprint || expectedSourceFingerprint !== contextSnapshotKey(payload)) {
    throw new PipelineError(409, "STALE_SELECTION", "Reload and review the current confirmed information before generating.");
  }

  // Server-only E2E replacement. Request input cannot enable it, and the guard
  // also requires the runner's isolated temporary database and upload folder.
  if (isIsolatedE2EMockAiEnabled()) {
    const project = payload.candidate.projects.items.find((item) => item.images.length > 0);
    const image = project?.images[0];
    const imageAnalyses: ImageAnalysisResult[] = project && image ? [{
      imageId: image.imageId,
      projectName: project.name,
      visibleFeatures: ["Synthetic E2E fixture pixels"],
      relevantSkills: [],
      presentationCaption: image.description.caption ?? image.description.altText,
      limitations: ["Mocked test analysis; no model was called."],
    }] : [];
    return {
      generation: {
        targetId,
        imageAnalyses,
        presentation: {
          title: "Mocked interview presentation",
          slides: ["Introduction", "Experience", "Projects", "Role fit"].map((heading, index) => ({
            heading,
            bullets: [`Mocked test content for ${heading.toLowerCase()}`],
            speakerNotes: "Synthetic E2E output. No model was called.",
            sourceIds: index === 2 && project ? [project.id] : [],
            imageIds: index === 2 && image ? [image.imageId] : [],
          })),
        },
        generatedAt: new Date().toISOString(),
      },
      sourceSnapshot: payload,
    };
  }

  const result = await runReliabilityPipeline(targetId, snapshotToken(payload));
  const reliability = ReliabilityMetadataSchema.parse({
    original: result.presentation, review: result.review,
    sources: sourceRegistry(result.inputSnapshot, result.imageAnalyses),
    selection: result.selection, omittedImages: result.omittedImages, metadata: result.metadata,
  });
  return {
    generation: {
      targetId,
      imageAnalyses: toEditorImageAnalyses(result.imageAnalyses),
      presentation: toEditorPresentation(result.presentation),
      generatedAt: result.generatedAt,
      reliability,
    },
    // The route persists exactly the input used by this run, never a later payload.
    sourceSnapshot: result.inputSnapshot,
  };
}
