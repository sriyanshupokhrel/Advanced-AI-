import { connection } from "next/server";
import { getLatestPresentationRecord } from "@/lib/db/presentation-repository";
import { internalError, notFound } from "@/lib/api/http";

type Context = RouteContext<"/api/targets/[id]/presentation">;

export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  try {
    const result = await getLatestPresentationRecord(id);
    if (!result.targetExists) return notFound("CV–job pairing");
    if (!result.record) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    return Response.json(result.record, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalError(error);
  }
}
