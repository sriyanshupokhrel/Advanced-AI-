import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageExtension } from "@/lib/storage/image-inspection";

/**
 * Stores uploaded image files on the local disk (storage/uploads). Files are
 * outside /public, so they are only reachable through the API route, which
 * looks them up by database id — a client can never supply a file path.
 *
 * This is the only module that touches the file system for images. To move to
 * cloud object storage (e.g. S3, Azure Blob), re-implement these four
 * functions; nothing else needs to change (see README "Image storage").
 */
// Defaults to <project>/storage/uploads. UPLOAD_DIR overrides it (used by the
// automated tests so they never touch real uploads). The folder holds runtime
// user data, not source files, so it is excluded from Next.js output tracing.
const UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"),
);

// Stored names are always generated here; this pattern rejects anything else
// (e.g. "../", absolute paths, NUL bytes) before a name is joined to UPLOAD_DIR.
const STORED_NAME_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

function resolveStoredPath(storedFileName: string): string {
  if (!STORED_NAME_PATTERN.test(storedFileName)) {
    throw new Error(`Invalid stored image name: ${storedFileName}`);
  }
  const resolved = path.resolve(UPLOAD_DIR, storedFileName);
  // Defence in depth: the result must stay directly inside UPLOAD_DIR.
  if (path.dirname(resolved) !== UPLOAD_DIR) {
    throw new Error(`Stored image path escapes the upload directory: ${storedFileName}`);
  }
  return resolved;
}

export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Writes a new file under a fresh random name and returns that name. */
export async function saveImageFile(bytes: Uint8Array, extension: ImageExtension) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const storedFileName = `${randomUUID()}.${extension}`;
  await writeFile(resolveStoredPath(storedFileName), bytes, { flag: "wx" });
  return storedFileName;
}

export async function readImageFile(storedFileName: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveStoredPath(storedFileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function imageFileExists(storedFileName: string): Promise<boolean> {
  try {
    await access(resolveStoredPath(storedFileName));
    return true;
  } catch {
    return false;
  }
}

/** Deletes a stored file; a file that is already gone is not an error. */
export async function deleteImageFile(storedFileName: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(storedFileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * Removes files whose database records are already gone. A failure here (e.g.
 * the file is locked) must not turn a successful delete into an error for the
 * user, so it is logged as an orphaned file instead of thrown.
 */
export async function deleteImageFilesBestEffort(storedFileNames: string[]): Promise<void> {
  const results = await Promise.allSettled(storedFileNames.map(deleteImageFile));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Orphaned image file could not be deleted: ${storedFileNames[i]}`, result.reason);
    }
  });
}
