import { z } from "zod";

const boundedText = (maximum: number) => z.string().max(maximum);

// Drafts share the generated structure but may contain temporarily blank text.
export const PresentationDraftSlideSchema = z.object({
  heading: boundedText(200),
  bullets: z.array(boundedText(1_000)).min(1).max(5),
  speakerNotes: boundedText(10_000),
  sourceIds: z.array(z.string().min(1).max(200)).max(50),
  imageIds: z.array(z.string().min(1).max(200)).max(20),
}).strict();

export const PresentationDraftSchema = z.object({
  title: boundedText(200),
  slides: z.array(PresentationDraftSlideSchema).min(4).max(5),
}).strict();

export const PresentationSlideSchema = PresentationDraftSlideSchema.extend({
  heading: boundedText(200).trim().min(1),
  bullets: z.array(boundedText(1_000).trim().min(1)).min(1).max(5),
});

export const InterviewPresentationSchema = z.object({
  title: boundedText(200).trim().min(1),
  slides: z.array(PresentationSlideSchema).min(4).max(5),
}).strict();

export type PresentationSlide = z.infer<typeof PresentationSlideSchema>;
export type InterviewPresentation = z.infer<typeof InterviewPresentationSchema>;
