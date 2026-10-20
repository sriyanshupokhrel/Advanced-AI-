import { connection, type NextRequest } from "next/server";
import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { internalError, notFound } from "@/lib/api/http";
import type { ApiErrorBody } from "@/types/cv";

type Context = RouteContext<"/api/targets/[id]/context">;

/**
 * GET /api/targets/{id}/context — the integration payload: CV, target job and
 * all images in one InterviewPreparationPayload (src/types/integration.ts).
 *
 * By default the payload is always returned, with `readiness` saying whether
 * everything is user-confirmed. With `?requireReady=true` a payload that is
 * not READY is refused with 409 and the list of issues, so a consumer can
 * never receive unconfirmed data by mistake.
 */
export async function GET(request: NextRequest, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  const requireReady = request.nextUrl.searchParams.get("requireReady") === "true";
  try {
    const payload = await getInterviewPreparationPayload(id);
    if (!payload) return notFound("CV–job pairing");

    if (requireReady && !payload.readiness.isReady) {
      const blocking = payload.readiness.issues.filter((issue) => issue.severity === "BLOCKING");
      const body: ApiErrorBody = {
        error: `This CV and job are not ready: ${blocking.length} item${blocking.length === 1 ? "" : "s"} still need${blocking.length === 1 ? "s" : ""} the user's review.`,
        issues: blocking,
      };
      return Response.json(body, { status: 409 });
    }
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalError(error);
  }
}
