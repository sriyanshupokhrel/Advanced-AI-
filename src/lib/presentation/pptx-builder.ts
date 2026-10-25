import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import { slideCanvasTokens } from "@/components/presentation/presentation-theme";
import type { InterviewPreparationPayload } from "@/types/integration";
import type { InterviewPresentation } from "@/types/presentation";
import type { ReliabilityMetadata } from "@/types/reliability";

export interface VerifiedExportImage {
  imageId: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif";
  width: number;
  height: number;
  altText: string;
  caption: string | null;
  bytes: Buffer;
}

export interface PresentationExportSnapshot {
  presentationId: string;
  targetId: string;
  revision: number;
  draft: InterviewPresentation;
  sourceSnapshot: InterviewPreparationPayload;
  images: Map<string, VerifiedExportImage>;
  reliability?: ReliabilityMetadata | null;
}

export interface PptxFitIssue { slideNumber: number; message: string }

/** Reject content that would require truncation or unreadably small type. */
export function inspectPptxFit(presentation: InterviewPresentation): PptxFitIssue[] {
  const issues: PptxFitIssue[] = [];
  if (presentation.title.length > 120) issues.push({ slideNumber: 0, message: "The presentation title is too long for the exported slide header (maximum 120 characters)." });
  presentation.slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    if (slide.heading.length > 95) issues.push({ slideNumber, message: `Slide ${slideNumber} heading is too long for readable export (maximum 95 characters).` });
    if (slide.imageIds.length > 2) issues.push({ slideNumber, message: `Slide ${slideNumber} references ${slide.imageIds.length} images; this layout supports at most 2 without cropping.` });
    const charsPerLine = slide.imageIds.length > 0 ? 45 : 78;
    const maxLines = slide.imageIds.length > 0 ? 12 : 14;
    const estimatedLines = slide.bullets.reduce((total, bullet) => total + Math.max(1, Math.ceil(bullet.length / charsPerLine)), 0);
    if (estimatedLines > maxLines) issues.push({ slideNumber, message: `Slide ${slideNumber} body is too long for readable export (estimated ${estimatedLines} lines; maximum ${maxLines}).` });
    slide.bullets.forEach((bullet, bulletIndex) => {
      if (bullet.length > 240) issues.push({ slideNumber, message: `Slide ${slideNumber} bullet ${bulletIndex + 1} is too long for readable export (maximum 240 characters).` });
    });
  });
  return issues;
}

function addContainedImage(slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>, image: VerifiedExportImage, box: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const subtype = image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1];
  slide.addImage({ data: `data:image/${subtype};base64,${image.bytes.toString("base64")}`, x: box.x + (box.w - width) / 2, y: box.y + (box.h - height) / 2, w: width, h: height, altText: image.altText });
}

function provenanceNotes(snapshot: PresentationExportSnapshot, slideIndex: number) {
  const slide = snapshot.draft.slides[slideIndex];
  return `${slide.speakerNotes}\n\n--- Sources and provenance (not part of the spoken script) ---\n` + [
    `Saved presentation revision: ${snapshot.revision}`,
    `Source IDs (candidate, job or visual): ${slide.sourceIds.length ? slide.sourceIds.join(", ") : "None"}`,
    `Generated original review: ${snapshot.reliability?.review.status ?? "NOT_AVAILABLE"}; current saved wording requires human review.`,
    `Image IDs: ${slide.imageIds.length ? slide.imageIds.join(", ") : "None"}`,
    "Image provenance: USER_UPLOADED_UNVERIFIED.",
    "User confirmation means reviewed by the user, not independently verified.",
    "User-edited wording has not been semantically re-reviewed.",
    ...[...(snapshot.reliability?.original.references ?? [])].filter(reference => reference.unitId.startsWith(`slide.${slideIndex}.`)).map(reference => `Original field ${reference.unitId}: ${reference.sourceIds.join(", ") || "No cited source"}.`),
  ].join("\n");
}

/** Builds one already-validated saved revision in memory and never mutates it. */
export async function buildPresentationPptx(snapshot: PresentationExportSnapshot): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Advanced AI interview preparation";
  pptx.subject = "Job-tailored interview presentation";
  pptx.title = snapshot.draft.title;
  pptx.revision = String(snapshot.revision);
  pptx.theme = { headFontFace: "Georgia", bodyFontFace: "Arial" };
  const colors = Object.fromEntries(Object.entries(slideCanvasTokens.colors).map(([key, value]) => [key, value.replace("#", "")])) as Record<keyof typeof slideCanvasTokens.colors, string>;

  snapshot.draft.slides.forEach((content, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: colors.background };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, line: { color: colors.accent, transparency: 100 }, fill: { color: colors.accent } });
    slide.addText(snapshot.draft.title, { x: 0.8, y: 0.32, w: 10.8, h: 0.28, fontFace: "Arial", fontSize: 10, color: colors.meta, margin: 0, breakLine: false });
    slide.addText(content.heading, { x: 0.8, y: 0.78, w: 11.75, h: 0.9, fontFace: "Georgia", fontSize: 28, color: colors.heading, margin: 0, valign: "middle", breakLine: false });
    slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 1.75, w: 0.85, h: 0, line: { color: colors.accent, width: 3 } });
    const hasImages = content.imageIds.length > 0;
    const textWidth = hasImages ? 6.35 : 11.4;
    const charsPerLine = hasImages ? 45 : 78;
    let y = 2.08;
    content.bullets.forEach((bullet) => {
      const height = Math.max(0.55, Math.max(1, Math.ceil(bullet.length / charsPerLine)) * 0.36 + 0.1);
      slide.addText(bullet, { x: 0.95, y, w: textWidth, h: height, fontFace: "Arial", fontSize: 20, color: colors.body, margin: 0.04, breakLine: false, valign: "top", bullet: { indent: 18 }, paraSpaceAfter: 6 });
      y += height + 0.12;
    });
    if (hasImages) {
      const boxHeight = content.imageIds.length === 1 ? 4.55 : 2.16;
      content.imageIds.forEach((imageId, imageIndex) => {
        const image = snapshot.images.get(imageId);
        if (!image) throw new Error(`Verified image ${imageId} was not available while building the file.`);
        const box = { x: 8.0, y: 1.95 + imageIndex * 2.38, w: 4.55, h: boxHeight };
        slide.addShape(pptx.ShapeType.rect, { ...box, line: { color: colors.rule, width: 1 }, fill: { color: colors.imageMat } });
        addContainedImage(slide, image, { x: box.x + 0.12, y: box.y + 0.12, w: box.w - 0.24, h: box.h - 0.24 });
      });
    }
    slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 6.98, w: 11.75, h: 0, line: { color: colors.rule, width: 1 } });
    slide.addText(`${index + 1} / ${snapshot.draft.slides.length}`, { x: 11.55, y: 7.08, w: 1, h: 0.2, align: "right", fontFace: "Arial", fontSize: 9, color: colors.meta, margin: 0 });
    slide.addNotes(provenanceNotes(snapshot, index));
  });
  const data = await pptx.write({ outputType: "nodebuffer", compression: true });
  const generated = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  const zip = await JSZip.loadAsync(generated);
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (!contentTypesFile) throw new Error("Generated PPTX is missing [Content_Types].xml.");
  const contentTypes = await contentTypesFile.async("string");
  // PptxGenJS 4.0.1 can declare unused default slideMaster2-4 parts. Remove
  // only those nonexistent master overrides; all real package parts stay intact.
  const cleanedContentTypes = contentTypes.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g, (entry, partName: string) => {
    if (!partName.startsWith("/ppt/slideMasters/") || zip.file(partName.slice(1))) return entry;
    return "";
  });
  if (cleanedContentTypes !== contentTypes) zip.file("[Content_Types].xml", cleanedContentTypes);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function presentationDownloadFileName(snapshot: PresentationExportSnapshot) {
  const raw = `${snapshot.sourceSnapshot.candidate.profile.fullName}-${snapshot.sourceSnapshot.targetJob.jobTitle ?? "interview"}-r${snapshot.revision}`;
  const safe = raw.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "interview-presentation";
  return `${safe}.pptx`;
}
