import {
  ALLOWED_IMAGE_LABEL,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  type AllowedImageType,
} from "@/lib/validation/image-schema";

/**
 * Validates an uploaded file by its actual bytes, ignoring the file name and
 * the browser-supplied MIME type. The format is identified by its signature
 * ("magic bytes") and then the format's own header is parsed to read the pixel
 * dimensions. A file that claims to be an image but has no readable header is
 * rejected.
 *
 * This is a structural check, not a full decode: a file with a valid header
 * but corrupt pixel data would pass. No image library is used, keeping the
 * dependency footprint small.
 */

export type ImageExtension = "png" | "jpg" | "webp" | "gif";

export interface InspectedImage {
  mimeType: AllowedImageType;
  extension: ImageExtension;
  width: number;
  height: number;
}

export type InspectionResult = { ok: true; image: InspectedImage } | { ok: false; error: string };

const UNSUPPORTED = `This file is not a supported image. Upload a ${ALLOWED_IMAGE_LABEL} file.`;
const CORRUPT = "This image appears to be damaged or incomplete. Try exporting it again.";

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, length: number) => String.fromCharCode(...b.subarray(i, i + length));
const startsWith = (b: Uint8Array, signature: number[], offset = 0) =>
  b.length >= offset + signature.length && signature.every((byte, i) => b[offset + i] === byte);

type Size = { width: number; height: number } | null;

function pngSize(b: Uint8Array): Size {
  // 8-byte signature, then the IHDR chunk must come first.
  if (b.length < 33 || ascii(b, 12, 4) !== "IHDR") return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function gifSize(b: Uint8Array): Size {
  const version = ascii(b, 0, 6);
  if (b.length < 13 || (version !== "GIF87a" && version !== "GIF89a")) return null;
  return { width: u16le(b, 6), height: u16le(b, 8) };
}

function webpSize(b: Uint8Array): Size {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // Lossy: key-frame start code 9D 01 2A, then 14-bit width and height.
    if (!startsWith(b, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // Lossless: signature 0x2F, then 14-bit (width-1) and (height-1).
    if (b[20] !== 0x2f) return null;
    const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    // Extended: 24-bit (canvas width-1) and (canvas height-1).
    return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  }
  return null;
}

function jpegSize(b: Uint8Array): Size {
  // Walk the marker segments until a Start-Of-Frame marker gives the size.
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // markers without a length field
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / scan data before any frame header
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    const segmentLength = u16be(b, i + 2);
    if (segmentLength < 2) return null;
    i += 2 + segmentLength;
  }
  return null;
}

export function inspectImage(bytes: Uint8Array): InspectionResult {
  let format: Omit<InspectedImage, "width" | "height"> | null = null;
  let size: Size = null;

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    format = { mimeType: "image/png", extension: "png" };
    size = pngSize(bytes);
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    format = { mimeType: "image/jpeg", extension: "jpg" };
    size = jpegSize(bytes);
  } else if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    format = { mimeType: "image/gif", extension: "gif" };
    size = gifSize(bytes);
  } else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    format = { mimeType: "image/webp", extension: "webp" };
    size = webpSize(bytes);
  }

  if (!format) return { ok: false, error: UNSUPPORTED };
  if (!size || size.width < 1 || size.height < 1) return { ok: false, error: CORRUPT };
  if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
    return {
      ok: false,
      error: `Image is ${size.width}×${size.height} pixels; the maximum is ${MAX_IMAGE_DIMENSION.toLocaleString("en-AU")} pixels per side.`,
    };
  }
  if (size.width * size.height > MAX_IMAGE_PIXELS) {
    return { ok: false, error: "Image resolution is too large. Resize it below 40 megapixels." };
  }
  return { ok: true, image: { ...format, ...size } };
}
