import { connection } from "next/server";
import { createCv, listCvSummaries } from "@/lib/db/cv-repository";
import { internalError, readJsonBody, validationError } from "@/lib/api/http";
import { cvSchema, toFieldErrors } from "@/lib/validation/cv-schema";

/** GET /api/cvs — list all CVs (newest first). */
export async function GET() {
  await connection(); // always read fresh data at request time
  try {
    return Response.json(await listCvSummaries());
  } catch (error) {
    return internalError(error);
  }
}

/** POST /api/cvs — create a CV. Body: CvInput. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = cvSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const cv = await createCv(parsed.data);
    return Response.json(cv, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
