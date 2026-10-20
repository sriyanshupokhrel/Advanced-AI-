import { connection } from "next/server";
import { StaleReviewError, deleteTarget, getTarget, setSectionConfirmations } from "@/lib/db/target-repository";
import { internalError, jsonError, notFound, readJsonBody, validationError } from "@/lib/api/http";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { targetConfirmationSchema } from "@/lib/validation/job-schema";

type Context = RouteContext<"/api/targets/[id]">;

/** GET /api/targets/{id} — one pairing with per-section status and readiness. */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  try {
    const target = await getTarget(id);
    return target ? Response.json(target) : notFound("CV–job pairing");
  } catch (error) {
    return internalError(error);
  }
}

/**
 * PATCH /api/targets/{id} — confirm or withdraw confirmation of sections.
 * Body: { confirmed: boolean, sections?: ReviewSection[], expectedFingerprints?: { [section]: sha256 } }
 * Omitting `sections` applies to all seven. Returns 409 if the data changed
 * since the fingerprints the client sent.
 */
export async function PATCH(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = targetConfirmationSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const target = await setSectionConfirmations(id, parsed.data);
    return target ? Response.json(target) : notFound("CV–job pairing");
  } catch (error) {
    if (error instanceof StaleReviewError) return jsonError(409, error.message);
    return internalError(error);
  }
}

/** DELETE /api/targets/{id} — remove the pairing (the CV and job are kept). */
export async function DELETE(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  try {
    return (await deleteTarget(id)) ? new Response(null, { status: 204 }) : notFound("CV–job pairing");
  } catch (error) {
    return internalError(error);
  }
}
