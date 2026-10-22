import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PRESENTATION_DEMO_SCENARIOS, SYNTHETIC_PRESENTATION_CONTEXT } from "@/lib/presentation/demo-data";
import { clonePresentation, hasNewerEditsThanSubmittedSave, presentationsEqual, resolveSlideReferences, updateBullet, updatePresentationTitle, updateSlide, validatePresentationDraft } from "@/lib/presentation/editor-model";
import { InterviewPresentationSchema, PresentationDraftSchema } from "@/types/presentation";

const standard = PRESENTATION_DEMO_SCENARIOS[0].presentation;
const boundary = PRESENTATION_DEMO_SCENARIOS[1].presentation;

describe("presentation draft isolation", () => {
  test("original and draft have no shared editable arrays", () => {
    const draft = clonePresentation(standard);
    assert.notEqual(draft, standard); assert.notEqual(draft.slides, standard.slides); assert.notEqual(draft.slides[0], standard.slides[0]); assert.notEqual(draft.slides[0].bullets, standard.slides[0].bullets);
  });
  test("editing title, bullet and speaker notes does not mutate original", () => {
    const before = clonePresentation(standard);
    let draft = updatePresentationTitle(clonePresentation(standard), "Edited title");
    draft = updateBullet(draft, 0, 0, "Edited bullet"); draft = updateSlide(draft, 0, { speakerNotes: "Edited notes" });
    assert.deepEqual(standard, before); assert.equal(draft.title, "Edited title"); assert.equal(draft.slides[0].bullets[0], "Edited bullet"); assert.equal(draft.slides[0].speakerNotes, "Edited notes");
  });
  test("editing a selected slide does not leak into another slide", () => {
    const draft = updateBullet(clonePresentation(standard), 1, 0, "Only slide two");
    assert.equal(draft.slides[1].bullets[0], "Only slide two"); assert.equal(draft.slides[0].bullets[0], standard.slides[0].bullets[0]); assert.equal(draft.slides[2].bullets[0], standard.slides[2].bullets[0]);
  });
  test("restore creates a clean independent draft", () => {
    const edited = updatePresentationTitle(clonePresentation(standard), "Changed"); assert.equal(presentationsEqual(standard, edited), false);
    const restored = clonePresentation(standard); assert.equal(presentationsEqual(standard, restored), true); assert.notEqual(restored.slides[0].bullets, standard.slides[0].bullets);
  });
});

describe("presentation structures and validation", () => {
  test("synthetic fixtures use the real 4 and 5 slide schema", () => {
    assert.equal(standard.slides.length, 4); assert.equal(boundary.slides.length, 5); assert.equal(InterviewPresentationSchema.safeParse(standard).success, true); assert.equal(InterviewPresentationSchema.safeParse(boundary).success, true);
  });
  test("temporarily empty title, heading and bullet report errors without restoring values", () => {
    let draft = updatePresentationTitle(clonePresentation(standard), ""); draft = updateSlide(draft, 0, { heading: "" }); draft = updateBullet(draft, 0, 0, "");
    const issues = validatePresentationDraft(draft); assert.equal(draft.title, ""); assert.equal(draft.slides[0].heading, ""); assert.equal(draft.slides[0].bullets[0], ""); assert.deepEqual(issues.map((issue) => issue.path), ["title", "slides.0.heading", "slides.0.bullets.0"]);
  });
  test("unfinished wording is saveable as a draft but not valid generated output", () => {
    const draft = updatePresentationTitle(clonePresentation(standard), "");
    assert.equal(PresentationDraftSchema.safeParse(draft).success, true);
    assert.equal(InterviewPresentationSchema.safeParse(draft).success, false);
    assert.equal(validatePresentationDraft(draft).some((issue) => issue.path === "title"), true);
  });
  test("a save response does not mark edits typed during the request as saved", () => {
    const submitted = updatePresentationTitle(clonePresentation(standard), "Submitted title");
    const newer = updatePresentationTitle(submitted, "Typed while saving");
    assert.equal(hasNewerEditsThanSubmittedSave(newer, submitted), true);
    assert.equal(hasNewerEditsThanSubmittedSave(submitted, submitted), false);
  });
});

describe("presentation evidence resolution", () => {
  test("source and image IDs resolve from the synthetic payload", () => {
    const resolved = resolveSlideReferences(standard.slides[2], SYNTHETIC_PRESENTATION_CONTEXT);
    assert.equal(resolved.sources.every((item) => item.status === "FOUND"), true); assert.equal(resolved.images.every((item) => item.status === "FOUND"), true); assert.equal(resolved.images[0].status === "FOUND" && resolved.images[0].value.projectName, "Orbit Planner");
  });
  test("unknown source and image IDs remain explicit missing references", () => {
    const slide = { ...standard.slides[0], sourceIds: ["missing-source"], imageIds: ["missing-image"] };
    const resolved = resolveSlideReferences(slide, SYNTHETIC_PRESENTATION_CONTEXT);
    assert.deepEqual(resolved.sources[0], { id: "missing-source", status: "MISSING" }); assert.deepEqual(resolved.images[0], { id: "missing-image", status: "MISSING" });
  });
});
