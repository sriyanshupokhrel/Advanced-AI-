
import "server-only";

import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { findImageRecord } from "@/lib/db/image-repository";
import { readImageFile } from "@/lib/storage/image-storage";

import {
  analyseProjectImage,
  type ImageAnalysisResult,
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
    targetId,
    imageAnalyses,
    presentation,
    generatedAt: new Date().toISOString(),
  };
}
