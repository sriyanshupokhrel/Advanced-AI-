import { connection, type NextRequest } from "next/server";
import { TargetReferenceError, createTarget, listTargets } from "@/lib/db/target-repository";
import { internalError, jsonError, readJsonBody, validationError } from "@/lib/api/http";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { cvJobTargetSchema } from "@/lib/validation/job-schema";

/**
 * GET /api/targets — list CV–job pairings.
 * Optional filters: ?cvId={cvProfileId}&jobId={jobDescriptionId}
 */
export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  try {
    const targets = await listTargets({
      cvProfileId: params.get("cvId") || undefined,
      jobDescriptionId: params.get("jobId") || undefined,
    });
    return Response.json(targets);
  } catch (error) {
    return internalError(error);
  }
}

/**
 * POST /api/targets — pair a CV with a job. Body: { cvProfileId, jobDescriptionId }.
 * Returns 201 for a new pairing or 200 with the existing one if already paired.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = cvJobTargetSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const { target, created } = await createTarget(parsed.data.cvProfileId, parsed.data.jobDescriptionId);
    return Response.json(target, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof TargetReferenceError) {
      return jsonError(404, error.message, { [error.field]: error.message });
    }
    return internalError(error);
  }
}
