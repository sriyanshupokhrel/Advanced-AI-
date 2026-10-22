
import "server-only";

import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { findImageRecord } from "@/lib/db/image-repository";
import { readImageFile } from "@/lib/storage/image-storage";
import type { ImageAnalysisResult } from "@/types/interview-generation";
import { isIsolatedE2EMockAiEnabled } from "./e2e-mock-guard";

import {
  analyseProjectImage,
} from "./image-analysis";

import {
  generateInterviewPresentation,
} from "./interview-generator";

export async function runInterviewAIPipeline(
  targetId: string
) {
  const payload = await getInterviewPreparationPayload(targetId);

  if (!payload) {
    throw new Error("CV-job target not found.");
  }

  if (
    !payload.readiness.isReady ||
    payload.readiness.status !== "READY"
  ) {
    throw new Error("CV and job must be confirmed.");
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

  const imageAnalyses: ImageAnalysisResult[] = [];

  for (const project of payload.candidate.projects.items) {
    for (const image of project.images) {
      if (!image.confirmation.isConfirmed || !image.fileAvailable) {
        continue;
      }

      const record = await findImageRecord(image.imageId);

      if (!record || record.cvProfileId !== payload.candidate.cvProfileId) {
        throw new Error("Image record missing or belongs to another CV.");
      }

      const bytes = await readImageFile(record.storedFileName);

      if (!bytes) {
        throw new Error("Uploaded image file not found.");
      }

      const analysis = await analyseProjectImage({
        image,
        imageBytes: bytes,
        projectName: project.name,
        projectDescription: project.description,
        jobDescription: payload.targetJob.descriptionText,
      });

      imageAnalyses.push(analysis);
    }
  }

  const presentation = await generateInterviewPresentation(
    payload,
    imageAnalyses
  );

  return {
    generation: {
      targetId,
      imageAnalyses,
      presentation,
      generatedAt: new Date().toISOString(),
    },
    // The route persists exactly the input used by this run, never a later payload.
    sourceSnapshot: payload,
  };
}
