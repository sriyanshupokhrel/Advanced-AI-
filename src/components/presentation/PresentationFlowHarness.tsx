"use client";

import { useMemo, useRef, useState } from "react";
import { PRESENTATION_DEMO_SCENARIOS, SYNTHETIC_PRESENTATION_CONTEXT } from "@/lib/presentation/demo-data";
import { clonePresentation } from "@/lib/presentation/editor-model";
import { contextSnapshotKey } from "@/lib/presentation/source-snapshot";
import { PresentationFlow, type PresentationFlowApi } from "./PresentationFlow";

/** Development-only browser harness. It exercises the real flow UI without calling a model. */
export type PresentationFlowHarnessState = "ready" | "saved" | "stale" | "not-ready" | "not-found" | "generate-failure" | "fail-regenerate" | "save-failure" | "export-failure" | "conflict";

export function PresentationFlowHarness({ state = "ready" }: { state?: PresentationFlowHarnessState }) {
  const [postCalls, setPostCalls] = useState(0);
  const [saveCalls, setSaveCalls] = useState(0);
  const [exportCalls, setExportCalls] = useState(0);
  const postCallsRef = useRef(0);
  const initialDraft = clonePresentation(PRESENTATION_DEMO_SCENARIOS[0].presentation);
  if (["saved", "stale", "save-failure", "export-failure", "conflict"].includes(state)) initialDraft.title = "Previously saved synthetic draft";
  const recordRef = useRef({
    id: "demo-presentation-1",
    targetId: SYNTHETIC_PRESENTATION_CONTEXT.targetId,
    original: PRESENTATION_DEMO_SCENARIOS[0].presentation,
    draft: initialDraft,
    imageAnalyses: [{ imageId: "demo-image-orbit", projectName: "Orbit Planner", visibleFeatures: ["A synthetic interface sample is visible"], relevantSkills: ["Interface design"], presentationCaption: "Synthetic Orbit Planner interface", limitations: ["The image does not prove authorship"] }],
    sourceSnapshot: SYNTHETIC_PRESENTATION_CONTEXT,
    sourceFingerprint: contextSnapshotKey(SYNTHETIC_PRESENTATION_CONTEXT),
    generatedAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
    revision: 1,
    stale: state === "stale" ? { isStale: true, reasons: ["Synthetic source content changed after generation."], unavailableImageIds: ["demo-image-orbit"] } : { isStale: false, reasons: [], unavailableImageIds: [] },
  });
  const api = useMemo<PresentationFlowApi>(() => ({
    getSaved: async () => {
      if (state === "not-found") return { ok: false, status: 404, error: { error: "CV–job pairing not found." } };
      return ["saved", "stale", "save-failure", "export-failure", "conflict"].includes(state)
        ? { ok: true, data: recordRef.current }
        : { ok: true, data: undefined };
    },
    getContext: async () => {
      if (state === "not-found") return { ok: false, status: 404, error: { error: "CV–job pairing not found." } };
      if (state === "not-ready") return { ok: false, status: 409, error: { error: "This CV and job are not ready: 1 item still needs the user's review.", issues: [{ code: "SECTION_NOT_CONFIRMED", severity: "BLOCKING", section: "SKILLS", itemId: null, message: "Skills have not been confirmed yet. Review them and click Confirm." }] } };
      return { ok: true, data: SYNTHETIC_PRESENTATION_CONTEXT };
    },
    generate: async () => {
      const callNumber = ++postCallsRef.current;
      setPostCalls(callNumber);
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (state === "generate-failure" || (state === "fail-regenerate" && callNumber > 1)) {
        return { ok: false, status: 500, error: { error: "Simulated provider failure. No model was called." } };
      }
      return {
        ok: true,
        data: {
          targetId: SYNTHETIC_PRESENTATION_CONTEXT.targetId,
          presentationId: `demo-presentation-${callNumber}`,
          revision: 1,
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          imageAnalyses: [{
            imageId: "demo-image-orbit",
            projectName: "Orbit Planner",
            visibleFeatures: ["A synthetic interface sample is visible"],
            relevantSkills: ["Interface design"],
            presentationCaption: "Synthetic Orbit Planner interface",
            limitations: ["The image does not prove authorship"],
          }],
          presentation: PRESENTATION_DEMO_SCENARIOS[0].presentation,
        },
      };
    },
    save: async (_targetId, _presentationId, draft, expectedRevision) => {
      setSaveCalls((value) => value + 1);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (state === "save-failure") return { ok: false, status: 500, error: { error: "Simulated save failure. Local edits were kept." } };
      if (state === "conflict") return { ok: false, status: 409, error: { error: "Simulated revision conflict. Local edits were kept." } };
      recordRef.current = { ...recordRef.current, draft: clonePresentation(draft), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
      return { ok: true, data: recordRef.current };
    },
    exportPptx: async (_targetId, _presentationId, expectedRevision) => {
      setExportCalls((value) => value + 1);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (state === "export-failure") return { ok: false, status: 422, error: { error: "Simulated export failure. The current draft was kept." } };
      return {
        ok: true,
        blob: new Blob(["synthetic PPTX harness response"], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        fileName: `synthetic-interview-r${expectedRevision}.pptx`,
        revision: expectedRevision,
      };
    },
  }), [state]);

  return (
    <div>
      <div className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        Development test harness — mocked provider, no AI call · State: {state} · Mock POST calls: {postCalls} · Mock saves: {saveCalls} · Mock exports: {exportCalls}
      </div>
      <PresentationFlow targetId={SYNTHETIC_PRESENTATION_CONTEXT.targetId} api={api} />
    </div>
  );
}
