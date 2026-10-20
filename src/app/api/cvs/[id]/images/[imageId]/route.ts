import { connection } from "next/server";
import {
  ImageRuleError,
  deleteImage,
  getImageForCv,
  replaceImageFile,
  updateImage,
} from "@/lib/db/image-repository";
import { internalError, jsonError, notFound, readJsonBody, validationError } from "@/lib/api/http";
import { FILE_TOO_LARGE, isDeclaredTooLarge, parseUploadedImage } from "@/lib/api/image-upload";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { imageUpdateSchema } from "@/lib/validation/image-schema";

/*
 * Every handler here requires the image to belong to the CV in the URL; an
 * image id from a different CV is reported as "not found".
 */
type Context = RouteContext<"/api/cvs/[id]/images/[imageId]">;

/** GET /api/cvs/{id}/images/{imageId} — one image's metadata. */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const { id, imageId } = await ctx.params;
  try {
    const image = await getImageForCv(id, imageId);
    return image ? Response.json(image) : notFound("Image");
  } catch (error) {
    return internalError(error);
  }
}

/**
 * PATCH /api/cvs/{id}/images/{imageId} — JSON body with any of
 * { kind, altText, caption, projectId, confirmed }. `projectId: ""` unlinks
 * the image; `confirmed: true` confirms the image as it is after this update.
 */
export async function PATCH(request: Request, ctx: Context) {
  const { id, imageId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = imageUpdateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  try {
    const image = await updateImage(id, imageId, parsed.data);
    return image ? Response.json(image) : notFound("Image");
  } catch (error) {
    if (error instanceof ImageRuleError) return validationError({ [error.field]: error.message });
    return internalError(error);
  }
}

/**
 * PUT /api/cvs/{id}/images/{imageId} — replace the image file (multipart,
 * field `file`). The id, description and project link are kept.
 */
export async function PUT(request: Request, ctx: Context) {
  const { id, imageId } = await ctx.params;
  if (isDeclaredTooLarge(request)) return jsonError(413, FILE_TOO_LARGE, { file: FILE_TOO_LARGE });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Upload must be sent as multipart/form-data.");
  }
  const file = await parseUploadedImage(form);
  if (!file.ok) return validationError({ file: file.error });

  try {
    const image = await replaceImageFile({ cvProfileId: id, imageId, ...file.upload });
    return image ? Response.json(image) : notFound("Image");
  } catch (error) {
    return internalError(error);
  }
}

/** DELETE /api/cvs/{id}/images/{imageId} — delete the image and its file. */
export async function DELETE(_request: Request, ctx: Context) {
  const { id, imageId } = await ctx.params;
  try {
    return (await deleteImage(id, imageId)) ? new Response(null, { status: 204 }) : notFound("Image");
  } catch (error) {
    return internalError(error);
  }
}
