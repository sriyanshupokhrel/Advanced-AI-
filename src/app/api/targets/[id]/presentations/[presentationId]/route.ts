import { ZodError } from "zod";
import { internalError, jsonError, notFound, readJsonBody } from "@/lib/api/http";
import {
  PresentationReferenceError,
  PresentationRevisionConflictError,
  savePresentationDraft,
} from "@/lib/db/presentation-repository";
import { SavePresentationDraftRequestSchema } from "@/types/interview-generation";

type Context = RouteContext<"/api/targets/[id]/presentations/[presentationId]">;

export async function PATCH(request: Request, ctx: Context) {
  const { id, presentationId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const input = SavePresentationDraftRequestSchema.parse(body.value);
    const saved = await savePresentationDraft({
      targetId: id,
      presentationId,
      draft: input.draft,
      expectedRevision: input.expectedRevision,
    });
    if (!saved) return notFound("Presentation");
    return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError || error instanceof PresentationReferenceError) {
      return jsonError(400, error instanceof PresentationReferenceError ? error.message : "The draft has an invalid structure or exceeds its size limits.");
    }
    if (error instanceof PresentationRevisionConflictError) {
      return jsonError(409, "This presentation was saved in another window. Your local edits were kept; reload only when you are ready to review the saved version.");
    }
    return internalError(error);
  }
}
