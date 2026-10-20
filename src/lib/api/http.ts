import type { ApiErrorBody, FieldErrors } from "@/types/cv";

/** Consistent JSON error shape for every API route: { error, fieldErrors? }. */
export function jsonError(status: number, error: string, fieldErrors?: FieldErrors) {
  const body: ApiErrorBody = fieldErrors ? { error, fieldErrors } : { error };
  return Response.json(body, { status });
}

export function validationError(fieldErrors: FieldErrors) {
  return jsonError(400, "Some information is missing or invalid.", fieldErrors);
}

export const notFound = (what: string) => jsonError(404, `${what} not found.`);

/**
 * Largest accepted JSON body. A maximal valid CV (every list at its item limit,
 * every field at its length limit) is well under this, so only abusive or
 * broken requests are refused.
 */
export const MAX_JSON_BODY_BYTES = 1_000_000;

export type JsonBody = { ok: true; value: unknown } | { ok: false; response: Response };

const bodyTooLarge = () =>
  jsonError(413, `Request body is too large (maximum ${MAX_JSON_BODY_BYTES / 1_000_000} MB).`);
const invalidJson = () => jsonError(400, "Request body must be valid JSON.");

/**
 * Reads and parses a JSON request body with a size cap. The body is streamed
 * and abandoned as soon as it exceeds the cap, so an oversized request is
 * never fully buffered in memory.
 */
export async function readJsonBody(request: Request): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) return { ok: false, response: bodyTooLarge() };
  if (!request.body) return { ok: false, response: invalidJson() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, response: bodyTooLarge() };
    }
    chunks.push(value);
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: invalidJson() };
  }
}

/** Logs unexpected errors server-side without leaking details to the client. */
export function internalError(error: unknown) {
  console.error(error);
  return jsonError(500, "Something went wrong on the server. Please try again.");
}
