import { connection } from "next/server";
import { StaleCvItemError, deleteCv, getCvById, updateCv } from "@/lib/db/cv-repository";
import { internalError, jsonError, notFound, readJsonBody, validationError } from "@/lib/api/http";
import { cvSchema, toFieldErrors } from "@/lib/validation/cv-schema";

type Context = RouteContext<"/api/cvs/[id]">;

/** GET /api/cvs/{id} — full CV including all sections and image metadata. */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  try {
    const cv = await getCvById(id);
    return cv ? Response.json(cv) : notFound("CV");
  } catch (error) {
    return internalError(error);
  }
}

/**
 * PUT /api/cvs/{id} — replace the CV with the submitted version. Items that
 * keep their `id` are updated, items without one are created, and omitted
 * items are deleted.
 */
export async function PUT(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = cvSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const cv = await updateCv(id, parsed.data);
    return cv ? Response.json(cv) : notFound("CV");
  } catch (error) {
    if (error instanceof StaleCvItemError) return jsonError(409, error.message);
    return internalError(error);
  }
}

/** DELETE /api/cvs/{id} — delete the CV and everything attached to it. */
export async function DELETE(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  try {
    const deleted = await deleteCv(id);
    return deleted ? new Response(null, { status: 204 }) : notFound("CV");
  } catch (error) {
    return internalError(error);
  }
}
