import { z } from "zod";
import type { InterviewPreparationPayload } from "@/types/integration";
import { InterviewPresentationSchema, PresentationDraftSchema } from "@/types/presentation";
import type { PresentationStaleStatus } from "@/lib/presentation/source-snapshot";
import { ReliabilityMetadataSchema, type ReliabilityMetadata } from "@/types/reliability";

export const ImageAnalysisResultSchema = z.object({
  imageId: z.string().min(1),
  projectName: z.string(),
  visibleFeatures: z.array(z.string()),
  relevantSkills: z.array(z.string()),
  presentationCaption: z.string(),
  limitations: z.array(z.string()),
  projectId: z.string().optional(),
  relevance: z.enum(["relevant", "irrelevant", "insufficient"]).optional(),
  relevanceReason: z.string().optional(),
});

export const InterviewGenerationResponseSchema = z.object({
  targetId: z.string().min(1),
  presentationId: z.string().min(1),
  revision: z.number().int().min(1),
  imageAnalyses: z.array(ImageAnalysisResultSchema),
  presentation: InterviewPresentationSchema,
  generatedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  reliability: ReliabilityMetadataSchema.nullish(),
});

export const SavePresentationDraftRequestSchema = z.object({
  draft: PresentationDraftSchema,
  expectedRevision: z.number().int().min(1),
}).strict();

export const ExportPresentationRequestSchema = z.object({
  expectedRevision: z.number().int().min(1),
  humanReviewed: z.literal(true),
}).strict();

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisResultSchema>;
export type InterviewGenerationResponse = z.infer<typeof InterviewGenerationResponseSchema>;
export type SavePresentationDraftRequest = z.infer<typeof SavePresentationDraftRequestSchema>;
export type ExportPresentationRequest = z.infer<typeof ExportPresentationRequestSchema>;

export interface SavedPresentationRecord {
  id: string;
  targetId: string;
  original: InterviewGenerationResponse["presentation"];
  draft: InterviewGenerationResponse["presentation"];
  imageAnalyses: ImageAnalysisResult[];
  sourceSnapshot: InterviewPreparationPayload;
  sourceFingerprint: string;
  generatedAt: string;
  updatedAt: string;
  revision: number;
  stale: PresentationStaleStatus;
  reliability?: ReliabilityMetadata | null;
}
