import { ZodError } from "zod";
import { internalError, jsonError, notFound, readJsonBody } from "@/lib/api/http";
import {
  PresentationNotReadyError,
  PresentationReferenceError,
  PresentationRevisionConflictError,
  PresentationSourceChangedError,
} from "@/lib/db/presentation-repository";
import {
  buildPresentationPptx,
  preparePresentationExport,
  presentationDownloadFileName,
  PRESENTATION_PPTX_MIME,
  PresentationExportValidationError,
} from "@/lib/presentation/pptx-export";
import { ExportPresentationRequestSchema } from "@/types/interview-generation";

type Context = RouteContext<"/api/targets/[id]/presentations/[presentationId]/export">;

export async function POST(request: Request, ctx: Context) {
  const { id, presentationId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = ExportPresentationRequestSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "A valid expectedRevision is required for export.");

  try {
    const snapshot = await preparePresentationExport({
      targetId: id,
      presentationId,
      expectedRevision: parsed.data.expectedRevision,
    });
    if (!snapshot) return notFound("Presentation");

    const bytes = await buildPresentationPptx(snapshot);
    const fileName = presentationDownloadFileName(snapshot);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": PRESENTATION_PPTX_MIME,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Presentation-Revision": String(snapshot.revision),
      },
    });
  } catch (error) {
    if (error instanceof PresentationRevisionConflictError) {
      return jsonError(409, "The saved revision changed before export. Keep your local edits, reload when ready, and review the latest saved version.");
    }
    if (error instanceof PresentationNotReadyError) return jsonError(409, error.message);
    if (error instanceof PresentationSourceChangedError) {
      return jsonError(409, `Source changed: ${error.message} Review and confirm the current information, then explicitly generate and save again.`);
    }
    if (error instanceof PresentationReferenceError) return jsonError(422, error.message);
    if (error instanceof PresentationExportValidationError) {
      return jsonError(422, `The saved draft cannot fit a readable PPTX: ${error.issues.join(" ")} Shorten the identified content, Save, and try again.`);
    }
    if (error instanceof ZodError) {
      return jsonError(422, "The saved draft is incomplete or invalid. Complete the highlighted title, headings and bullets, Save, and try again.");
    }
    return internalError(error);
  }
}
