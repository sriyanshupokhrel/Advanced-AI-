import { connection } from "next/server";
import { deleteJob, getJobById, updateJob } from "@/lib/db/job-repository";
import { internalError, notFound, readJsonBody, validationError } from "@/lib/api/http";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { jobDescriptionSchema } from "@/lib/validation/job-schema";

type Context = RouteContext<"/api/jobs/[id]">;

/** GET /api/jobs/{id} — one job description, with its full text. */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  try {
    const job = await getJobById(id);
    return job ? Response.json(job) : notFound("Job description");
  } catch (error) {
    return internalError(error);
  }
}

/** PUT /api/jobs/{id} — replace a job description. */
export async function PUT(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = jobDescriptionSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const job = await updateJob(id, parsed.data);
    return job ? Response.json(job) : notFound("Job description");
  } catch (error) {
    return internalError(error);
  }
}

/** DELETE /api/jobs/{id} — delete a job description and its CV pairings. */
export async function DELETE(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  try {
    return (await deleteJob(id)) ? new Response(null, { status: 204 }) : notFound("Job description");
  } catch (error) {
    return internalError(error);
  }
}
