import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clonePresentation, updatePresentationTitle } from "@/lib/presentation/editor-model";
import { PRESENTATION_DEMO_SCENARIOS, SYNTHETIC_PRESENTATION_CONTEXT } from "@/lib/presentation/demo-data";
import {
  classifyContextFailure,
  contextSnapshotKey,
  generationReducer,
  initialGenerationState,
  isReadyContextForTarget,
  validateGenerationResponse,
  validateSavedPresentationRecord,
} from "@/lib/presentation/generation-session";

const original = PRESENTATION_DEMO_SCENARIOS[0].presentation;
const response = (targetId = SYNTHETIC_PRESENTATION_CONTEXT.targetId) => ({
  targetId,
  presentationId: "presentation-1",
  revision: 1,
  generatedAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  imageAnalyses: [{
    imageId: "demo-image-orbit",
    projectName: "Orbit Planner",
    visibleFeatures: ["A synthetic interface"],
    relevantSkills: ["UI design"],
    presentationCaption: "Synthetic interface sample",
    limitations: ["Does not prove authorship"],
  }],
  presentation: original,
});

describe("presentation context state", () => {
  it("recognises a READY context only for the requested target", () => {
    assert.equal(isReadyContextForTarget(SYNTHETIC_PRESENTATION_CONTEXT, SYNTHETIC_PRESENTATION_CONTEXT.targetId), true);
    assert.equal(isReadyContextForTarget(SYNTHETIC_PRESENTATION_CONTEXT, "another-target"), false);
    assert.equal(isReadyContextForTarget({ targetId: SYNTHETIC_PRESENTATION_CONTEXT.targetId }, SYNTHETIC_PRESENTATION_CONTEXT.targetId), false);
  });

  it("classifies not-found, not-ready and ordinary failures", () => {
    assert.equal(classifyContextFailure(404, { error: "missing" }).kind, "NOT_FOUND");
    const notReady = classifyContextFailure(409, { error: "review", issues: SYNTHETIC_PRESENTATION_CONTEXT.readiness.issues });
    assert.equal(notReady.kind, "NOT_READY");
    assert.equal(classifyContextFailure(500, { error: "safe message" }).kind, "ERROR");
  });

  it("changes its snapshot when confirmed input metadata changes", () => {
    const changed = structuredClone(SYNTHETIC_PRESENTATION_CONTEXT);
    changed.fingerprints.PROFILE = "8".repeat(64);
    assert.notEqual(contextSnapshotKey(changed), contextSnapshotKey(SYNTHETIC_PRESENTATION_CONTEXT));
  });

  it("ignores request-time and ordinary update timestamps in the stable snapshot", () => {
    const changed = structuredClone(SYNTHETIC_PRESENTATION_CONTEXT);
    changed.generatedAt = "2030-01-01T00:00:00.000Z";
    changed.candidate.lastUpdatedAt = "2030-01-01T00:00:00.000Z";
    changed.targetJob.lastUpdatedAt = "2030-01-01T00:00:00.000Z";
    assert.equal(contextSnapshotKey(changed), contextSnapshotKey(SYNTHETIC_PRESENTATION_CONTEXT));
  });
});

describe("saved presentation validation", () => {
  it("restores a persisted draft separately from its immutable original", () => {
    const draft = updatePresentationTitle(clonePresentation(original), "Saved user wording");
    const stored = {
      id: "presentation-1",
      targetId: SYNTHETIC_PRESENTATION_CONTEXT.targetId,
      original,
      draft,
      imageAnalyses: response().imageAnalyses,
      sourceSnapshot: SYNTHETIC_PRESENTATION_CONTEXT,
      sourceFingerprint: contextSnapshotKey(SYNTHETIC_PRESENTATION_CONTEXT),
      generatedAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:01:00.000Z",
      revision: 2,
      stale: { isStale: false, reasons: [], unavailableImageIds: [] },
    };
    const checked = validateSavedPresentationRecord(stored, SYNTHETIC_PRESENTATION_CONTEXT.targetId);
    assert.equal(checked.ok, true);
    if (!checked.ok) return;
    assert.equal(checked.value.response.presentation.title, original.title);
    assert.equal(checked.value.draft.title, "Saved user wording");
    assert.notEqual(checked.value.draft, checked.value.response.presentation);
  });
});

describe("generation response validation", () => {
  it("accepts the real response shape and creates an independent draft", () => {
    const checked = validateGenerationResponse(response(), SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT);
    assert.equal(checked.ok, true);
    if (!checked.ok) return;
    const draft = updatePresentationTitle(clonePresentation(checked.value.response.presentation), "Edited title");
    assert.equal(checked.value.response.presentation.title, original.title);
    assert.equal(draft.title, "Edited title");
  });

  it("rejects malformed data and a mismatched targetId", () => {
    assert.equal(validateGenerationResponse({}, SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT).ok, false);
    assert.equal(validateGenerationResponse(response("wrong-target"), SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT).ok, false);
  });

  it("rejects image IDs that do not match both context and this analysis run", () => {
    const missingAnalysis = response();
    missingAnalysis.imageAnalyses = [];
    assert.equal(validateGenerationResponse(missingAnalysis, SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT).ok, false);

    const foreignAnalysis = response();
    foreignAnalysis.imageAnalyses[0].imageId = "foreign-image";
    assert.equal(validateGenerationResponse(foreignAnalysis, SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT).ok, false);
  });

  it("keeps unknown source IDs visible as warnings instead of substituting evidence", () => {
    const unknown = response();
    unknown.presentation = structuredClone(original);
    unknown.presentation.slides[0].sourceIds = ["missing-source"];
    const checked = validateGenerationResponse(unknown, SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT);
    assert.equal(checked.ok, true);
    if (checked.ok) assert.deepEqual(checked.value.referenceWarnings, ["Unknown source reference: missing-source"]);
  });
});

describe("generation request concurrency", () => {
  it("ignores duplicate starts and late responses", () => {
    const generating = generationReducer(initialGenerationState, { type: "BEGIN", requestId: 1 });
    assert.equal(generating.activeRequestId, 1);
    assert.equal(generationReducer(generating, { type: "BEGIN", requestId: 2 }), generating);
    const accepted = validateGenerationResponse(response(), SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(generationReducer(generating, { type: "SUCCESS", requestId: 2, accepted: accepted.value }), generating);
  });

  it("keeps an existing successful result when a later generation fails", () => {
    const accepted = validateGenerationResponse(response(), SYNTHETIC_PRESENTATION_CONTEXT.targetId, SYNTHETIC_PRESENTATION_CONTEXT);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const successful = generationReducer(
      generationReducer(initialGenerationState, { type: "BEGIN", requestId: 1 }),
      { type: "SUCCESS", requestId: 1, accepted: accepted.value },
    );
    const regenerating = generationReducer(successful, { type: "BEGIN", requestId: 2 });
    const failed = generationReducer(regenerating, { type: "FAILURE", requestId: 2, message: "simulated provider failure" });
    assert.equal(failed.accepted, successful.accepted);
    assert.equal(failed.error, "simulated provider failure");
  });
});
