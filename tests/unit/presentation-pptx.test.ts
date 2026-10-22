import assert from "node:assert/strict";
import { describe, test } from "node:test";
import JSZip from "jszip";
import { PRESENTATION_DEMO_SCENARIOS, SYNTHETIC_PRESENTATION_CONTEXT } from "@/lib/presentation/demo-data";
import { clonePresentation } from "@/lib/presentation/editor-model";
import {
  buildPresentationPptx,
  inspectPptxFit,
  presentationDownloadFileName,
  type PresentationExportSnapshot,
  type VerifiedExportImage,
} from "@/lib/presentation/pptx-builder";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function snapshot(slideCount: 4 | 5): PresentationExportSnapshot {
  const source = PRESENTATION_DEMO_SCENARIOS[slideCount === 4 ? 0 : 1].presentation;
  const draft = clonePresentation(source);
  draft.title = `Saved edited ${slideCount}-slide draft`;
  if (slideCount === 5) {
    draft.slides[0].heading = "Introduction to a collaborative graduate product engineering perspective";
    draft.slides[4].bullets[4] = "Treat cited profile statements as user-confirmed, not independently verified.";
  }
  const imageIds = new Set(draft.slides.flatMap((slide) => slide.imageIds));
  const images = new Map<string, VerifiedExportImage>();
  for (const imageId of imageIds) {
    images.set(imageId, {
      imageId,
      mimeType: "image/png",
      width: 1,
      height: 1,
      altText: `Synthetic ${imageId}`,
      caption: null,
      bytes: png,
    });
  }
  return {
    presentationId: `presentation-${slideCount}`,
    targetId: SYNTHETIC_PRESENTATION_CONTEXT.targetId,
    revision: 7,
    draft,
    sourceSnapshot: SYNTHETIC_PRESENTATION_CONTEXT,
    images,
  };
}

async function inspect(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const slides = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  const notes = names.filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)).sort();
  const media = names.filter((name) => /^ppt\/media\//.test(name));
  const slideXml = await Promise.all(slides.map((name) => zip.file(name)!.async("string")));
  const noteXml = await Promise.all(notes.map((name) => zip.file(name)!.async("string")));
  const contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  return { slides, notes, media, slideXml, noteXml, contentTypes };
}

describe("PPTX export layout and package", () => {
  test("rejects content that would require truncation or unreadably small text", () => {
    const input = snapshot(4).draft;
    input.slides[1].bullets[0] = "x".repeat(241);
    const issues = inspectPptxFit(input);
    assert.equal(issues.some((issue) => issue.slideNumber === 2 && issue.message.includes("bullet 1")), true);
  });

  for (const count of [4, 5] as const) {
    test(`builds ${count} editable slides with notes and embedded images`, async () => {
      const input = snapshot(count);
      assert.deepEqual(inspectPptxFit(input.draft), []);
      const before = JSON.stringify(input);
      const result = await inspect(await buildPresentationPptx(input));
      assert.equal(result.slides.length, count);
      assert.equal(result.notes.length, count);
      assert.equal(result.media.length >= 1, true);
      assert.equal(result.slideXml.join("\n").includes(`Saved edited ${count}-slide draft`), true);
      assert.equal(result.slideXml.join("\n").includes("Nova Chen · Graduate Product Engineer"), false);
      assert.equal(result.noteXml[0].includes(input.draft.slides[0].speakerNotes), true);
      assert.equal(result.noteXml[0].includes("USER_UPLOADED_UNVERIFIED"), true);
      assert.equal(result.noteXml[0].includes("Saved presentation revision: 7"), true);
      assert.equal(result.contentTypes.includes("slideMaster2.xml"), false);
      assert.equal(JSON.stringify(input), before, "export must not mutate the saved revision snapshot");
    });
  }

  test("creates an ASCII-safe revisioned filename", () => {
    const name = presentationDownloadFileName(snapshot(4));
    assert.match(name, /^Nova-Chen-Graduate-Product-Engineer-r7\.pptx$/);
    assert.equal(name.includes("\\"), false);
    assert.equal(name.includes("/"), false);
  });
});
