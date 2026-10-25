import { type InspectedImage } from "@/lib/storage/image-inspection";
import { decodeImage } from "@/lib/storage/image-decode";
import { MAX_IMAGE_BYTES } from "@/lib/validation/image-schema";

// Allowance for multipart boundaries and the small text fields.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const FILE_TOO_LARGE = `Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)} MB or smaller.`;

/**
 * True when the declared body size already exceeds the limit, so the request
 * can be refused before the body is read into memory.
 */
export function isDeclaredTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES;
}

export type UploadedImage = { bytes: Uint8Array; inspected: InspectedImage; originalName: string };

/** Reads and validates the `file` field of a multipart form. */
export async function parseUploadedImage(
  form: FormData,
): Promise<{ ok: true; upload: UploadedImage } | { ok: false; error: string }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file to upload." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: FILE_TOO_LARGE };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await decodeImage(bytes);
  if (!result.ok) return { ok: false, error: result.error };

  // Keep only the base name; it is display metadata and never used as a path.
  const originalName = (file.name.split(/[\\/]/).pop() || "image").replace(/[\u0000-\u001f]/g, "");
  return { ok: true, upload: { bytes, inspected: result.image, originalName } };
}
