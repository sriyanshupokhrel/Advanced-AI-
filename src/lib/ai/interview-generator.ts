import { reviewPresentationClaims } from "./claim-review";
import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type { InterviewPreparationPayload } from "@/types/integration";
import {
  selectRelevantEvidence,
} from "./content-selector";
import type { ImageAnalysisResult } from "./image-analysis";
import { buildInterviewPrompt } from "./prompt-builder";

const SlideSchema = z.object({
  heading: z.string().min(1),
  bullets: z.array(z.string()).min(1).max(5),
  speakerNotes: z.string(),
  sourceIds: z.array(z.string()),
  imageIds: z.array(z.string()),
});

const PresentationSchema = z.object({
  title: z.string().min(1),
  slides: z.array(SlideSchema).min(4).max(5),
});

export type InterviewPresentation =
  z.infer<typeof PresentationSchema>;

export async function generateInterviewPresentation(
  payload: InterviewPreparationPayload,
  images: ImageAnalysisResult[] = []
): Promise<InterviewPresentation> {
  if (
    payload.contractVersion !== "2.0" ||
    !payload.readiness.isReady ||
    payload.readiness.status !== "READY"
  ) {
    throw new Error("Confirmed CV and job data required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const evidence = selectRelevantEvidence(payload, 12);
  const prompt = buildInterviewPrompt(
    payload,
    evidence,
    images
  );

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned no presentation.");
  }

  const presentation = PresentationSchema.parse(
    JSON.parse(response.text)
  );

  const allowedSourceIds = new Set(
    evidence.map(item => item.sourceId)
  );

  const allowedImageIds = new Set(
    images.map(item => item.imageId)
  );

  for (const slide of presentation.slides) {
    if (
      slide.sourceIds.some(
        id => !allowedSourceIds.has(id)
      )
    ) {
      throw new Error(
        "AI generated an unknown CV evidence reference."
      );
    }

    if (
      slide.imageIds.some(
        id => !allowedImageIds.has(id)
      )
    ) {
      throw new Error(
        "AI generated an unknown image reference."
      );
    }
  }
  const review = await reviewPresentationClaims(
  payload,
  presentation
);

if (!review.approved) {
  throw new Error(
    "Generated presentation requires evidence review: " +
    JSON.stringify(review.findings.filter(x => !x.supported))
  );
}
  return presentation;
}
