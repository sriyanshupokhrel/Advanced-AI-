import { connection } from "next/server";
import { cvExists } from "@/lib/db/cv-repository";
import { ImageRuleError, createImage, listImagesForCv } from "@/lib/db/image-repository";
import { internalError, jsonError, notFound, validationError } from "@/lib/api/http";
import { FILE_TOO_LARGE, isDeclaredTooLarge, parseUploadedImage } from "@/lib/api/image-upload";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { imageMetadataSchema } from "@/lib/validation/image-schema";

type Context = RouteContext<"/api/cvs/[id]/images">;

/** GET /api/cvs/{id}/images — metadata for all images attached to a CV. */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id } = await ctx.params;
  try {
    if (!(await cvExists(id))) return notFound("CV");
    return Response.json(await listImagesForCv(id));
  } catch (error) {
    return internalError(error);
  }
}

/**
 * POST /api/cvs/{id}/images — upload one image (multipart/form-data).
 * Fields: file, kind, altText, caption (optional), projectId (optional; must
 * be a project of this CV).
 */
export async function POST(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (isDeclaredTooLarge(request)) return jsonError(413, FILE_TOO_LARGE, { file: FILE_TOO_LARGE });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Upload must be sent as multipart/form-data.");
  }

  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const parsed = imageMetadataSchema.safeParse({
    kind: field("kind"),
    altText: field("altText"),
    caption: field("caption"),
    projectId: field("projectId"),
  });
  const fieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
  const file = await parseUploadedImage(form);
  if (!file.ok) fieldErrors.file = file.error;
  if (!parsed.success || !file.ok) return validationError(fieldErrors);

  try {
    if (!(await cvExists(id))) return notFound("CV");
    const image = await createImage({ cvProfileId: id, metadata: parsed.data, ...file.upload });
    return Response.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof ImageRuleError) return validationError({ [error.field]: error.message });
    return internalError(error);
  }
}
