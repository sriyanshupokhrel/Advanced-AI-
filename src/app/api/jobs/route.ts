import { connection } from "next/server";
import { createJob, listJobSummaries } from "@/lib/db/job-repository";
import { internalError, readJsonBody, validationError } from "@/lib/api/http";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { jobDescriptionSchema } from "@/lib/validation/job-schema";

/** GET /api/jobs — list saved job descriptions (newest first). */
export async function GET() {
  await connection();
  try {
    return Response.json(await listJobSummaries());
  } catch (error) {
    return internalError(error);
  }
}

/** POST /api/jobs — save a job description. Body: JobDescriptionInput. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = jobDescriptionSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    return Response.json(await createJob(parsed.data), { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
