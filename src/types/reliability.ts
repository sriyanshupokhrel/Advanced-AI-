import { z } from "zod";
import { PresentationSchema } from "@/lib/ai/presentation-schema";

// Review applies to the generated original, never automatically to edited wording.
export const ReliabilityMetadataSchema = z.object({
  original: PresentationSchema,
  review: z.object({
    approved: z.literal(false), coverageComplete: z.boolean(),
    status: z.enum(["HUMAN_REVIEW_REQUIRED", "NEEDS_CHANGES", "INCOMPLETE_REVIEW"]),
    findings: z.array(z.object({
      unitId: z.string(), slideIndex: z.number().int(), claim: z.string(),
      kind: z.enum(["candidate", "job", "visual", "mixed", "label", "intent"]),
      sourceIds: z.array(z.string()), evidence: z.array(z.object({ sourceId: z.string(), quote: z.string() })),
      supported: z.boolean(), reason: z.string(),
    })), limitations: z.string(),
  }),
  sources: z.array(z.object({ sourceId: z.string(), kind: z.enum(["candidate", "job", "visual"]), text: z.string(), projectId: z.string().optional() })),
  selection: z.object({
    method: z.string(), warning: z.string(), zeroMatch: z.boolean(),
    selected: z.array(z.object({ sourceId: z.string(), title: z.string(), relevanceScore: z.number() })),
    omitted: z.array(z.object({ sourceId: z.string(), title: z.string(), relevanceScore: z.number() })),
    jobTermsWithoutLexicalEvidence: z.array(z.string()),
  }),
  omittedImages: z.array(z.object({ imageId: z.string(), reason: z.string() })),
  metadata: z.object({ model: z.string(), promptVersion: z.string(), calls: z.number(), elapsedMs: z.number() }),
});
export type ReliabilityMetadata = z.infer<typeof ReliabilityMetadataSchema>;
