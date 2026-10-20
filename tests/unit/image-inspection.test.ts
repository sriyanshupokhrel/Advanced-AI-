import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { inspectImage } from "@/lib/storage/image-inspection";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
const b64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

/** PNG signature + IHDR claiming the given size (header only). */
function pngHeader(width: number, height: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return new Uint8Array(b);
}

function expectImage(bytes: Uint8Array, mimeType: string, width: number, height: number) {
  const result = inspectImage(bytes);
  assert.ok(result.ok, !result.ok ? result.error : "");
  assert.equal(result.image.mimeType, mimeType);
  assert.equal(result.image.width, width);
  assert.equal(result.image.height, height);
}

function expectRejected(bytes: Uint8Array, pattern: RegExp) {
  const result = inspectImage(bytes);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, pattern);
}

describe("accepted formats (dimensions read from the file header)", () => {
  // Fixture sizes were cross-checked with the Windows image decoder (System.Drawing).
  test("PNG 640×480", () => expectImage(fixture("diagram-640x480.png"), "image/png", 640, 480));
  test("JPEG 280×175", () => expectImage(fixture("photo-280x175.jpg"), "image/jpeg", 280, 175));
  test("JPEG 1920×1200", () => expectImage(fixture("photo-1920x1200.jpg"), "image/jpeg", 1920, 1200));
  test("WebP lossy", () => expectImage(b64("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"), "image/webp", 1, 1));
  test("WebP lossless", () => expectImage(b64("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="), "image/webp", 1, 1));
  test("WebP extended", () =>
    expectImage(
      b64("UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA=="),
      "image/webp",
      1,
      1,
    ));
  test("GIF", () => expectImage(b64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), "image/gif", 1, 1));
});

describe("rejected files", () => {
  test("plain text", () => expectRejected(new TextEncoder().encode("hello, not an image"), /not a supported image/));
  test("SVG (scriptable, not allowed)", () =>
    expectRejected(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'), /not a supported image/));
  test("empty file", () => expectRejected(new Uint8Array(), /not a supported image/));
  test("PNG signature without a header", () =>
    expectRejected(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), /damaged or incomplete/));
  test("truncated JPEG", () => expectRejected(fixture("photo-280x175.jpg").subarray(0, 12), /damaged or incomplete/));
  test("side longer than 10,000 px", () => expectRejected(pngHeader(20_000, 10), /maximum is 10,000/));
  test("decompression bomb (81 MP)", () => expectRejected(pngHeader(9_000, 9_000), /40 megapixels/));
  test("zero-sized image", () => expectRejected(pngHeader(0, 10), /damaged or incomplete/));
});
