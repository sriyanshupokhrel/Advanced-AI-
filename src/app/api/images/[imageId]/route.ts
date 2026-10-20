import { connection } from "next/server";
import { findImageRecord } from "@/lib/db/image-repository";
import { internalError, notFound } from "@/lib/api/http";
import { readImageFile } from "@/lib/storage/image-storage";

type Context = RouteContext<"/api/images/[imageId]">;

/**
 * GET /api/images/{imageId} — the image file itself. The file is located via
 * the database record (never from anything in the URL), and is served with
 * the media type validated at upload.
 */
export async function GET(request: Request, ctx: Context) {
  await connection();
  const { imageId } = await ctx.params;
  try {
    const image = await findImageRecord(imageId);
    if (!image) return notFound("Image");

    const etag = image.sha256 ? `"${image.sha256}"` : null;
    if (etag && request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const file = await readImageFile(image.storedFileName);
    if (!file) return notFound("Image file");

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(file.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=3600",
        ...(etag ? { ETag: etag } : {}),
      },
    });
  } catch (error) {
    return internalError(error);
  }
}
