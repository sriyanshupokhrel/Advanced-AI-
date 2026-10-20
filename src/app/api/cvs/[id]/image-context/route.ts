import { connection, type NextRequest } from "next/server";
import { cvExists } from "@/lib/db/cv-repository";
import { getImageEvidenceForCv } from "@/lib/db/image-repository";
import { internalError, notFound } from "@/lib/api/http";

type Context = RouteContext<"/api/cvs/[id]/image-context">;

/**
 * GET /api/cvs/{id}/image-context — the per-image multimodal contract
 * (ImageEvidenceContext[]) for a CV, each image with its linked project.
 *
 * Query options:
 *   ?confirmedOnly=true  only images the user has confirmed (recommended)
 *   ?projectId={id}      only images linked to that project
 */
export async function GET(request: NextRequest, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  const query = request.nextUrl.searchParams;
  try {
    if (!(await cvExists(id))) return notFound("CV");
    return Response.json(
      await getImageEvidenceForCv(id, {
        confirmedOnly: query.get("confirmedOnly") === "true",
        projectId: query.get("projectId") || undefined,
      }),
    );
  } catch (error) {
    return internalError(error);
  }
}
