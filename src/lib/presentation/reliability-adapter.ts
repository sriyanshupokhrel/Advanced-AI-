import type { InterviewPresentation as ReviewedPresentation } from "@/lib/ai/presentation-schema";
import type { ImageAnalysisResult as ReviewedImage } from "@/lib/ai/image-analysis";
import type { InterviewPresentation } from "@/types/presentation";
import type { ImageAnalysisResult } from "@/types/interview-generation";

/** Preserve the existing editor contract; retain richer originals as review metadata. */
export function toEditorPresentation(deck: ReviewedPresentation): InterviewPresentation {
  return { title: deck.title, slides: deck.slides.map(({ heading, bullets, speakerNotes, sourceIds, imageIds }) => ({
    heading, bullets: [...bullets], speakerNotes, sourceIds: [...sourceIds], imageIds: [...imageIds],
  })) };
}
export function toEditorImageAnalyses(images: ReviewedImage[]): ImageAnalysisResult[] {
  return images.map(image => ({ ...image, relevantSkills: [] }));
}
