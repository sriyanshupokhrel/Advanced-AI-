"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { targetApi, type ApiResult, type DownloadResult } from "@/lib/api/api-client";
import {
  classifyContextFailure,
  contextSnapshotKey,
  generationReducer,
  initialGenerationState,
  isReadyContextForTarget,
  validateGenerationResponse,
  validateSavedPresentationRecord,
  type ContextFailure,
} from "@/lib/presentation/generation-session";
import type { InterviewPreparationPayload } from "@/types/integration";
import type { InterviewPresentation } from "@/types/presentation";
import { AlertIcon, InfoIcon, WarningIcon } from "./PresentationIcons";
import { PresentationEditor } from "./PresentationEditor";
import { editorCssVars, presentationTheme as t } from "./presentation-theme";

export interface PresentationFlowApi {
  getContext(targetId: string): Promise<ApiResult<unknown>>;
  getSaved(targetId: string): Promise<ApiResult<unknown>>;
  generate(targetId: string): Promise<ApiResult<unknown>>;
  save(targetId: string, presentationId: string, draft: InterviewPresentation, expectedRevision: number): Promise<ApiResult<unknown>>;
  exportPptx(targetId: string, presentationId: string, expectedRevision: number): Promise<DownloadResult>;
}

const defaultApi: PresentationFlowApi = {
  getContext: (targetId) => targetApi.getInterviewContext(targetId),
  getSaved: (targetId) => targetApi.getSavedPresentation(targetId),
  generate: (targetId) => targetApi.generateInterview(targetId),
  save: (targetId, presentationId, draft, expectedRevision) =>
    targetApi.savePresentationDraft(targetId, presentationId, draft, expectedRevision),
  exportPptx: (targetId, presentationId, expectedRevision) =>
    targetApi.exportPresentationPptx(targetId, presentationId, expectedRevision),
};

type ContextState =
  | { kind: "LOADING" }
  | { kind: "READY"; context: InterviewPreparationPayload }
  | ContextFailure;

function targetLabel(context: InterviewPreparationPayload) {
  const job = context.targetJob;
  return `${context.candidate.profile.fullName} → ${job.jobTitle ?? "Untitled job"}${job.company.name ? ` at ${job.company.name}` : ""}`;
}

export function PresentationFlow({ targetId, api = defaultApi }: { targetId: string; api?: PresentationFlowApi }) {
  const [contextState, setContextState] = useState<ContextState>({ kind: "LOADING" });
  const [generation, dispatchGeneration] = useReducer(generationReducer, initialGenerationState);
  const lifecycleRef = useRef(0);
  const requestCounterRef = useRef(0);
  const activeRequestRef = useRef<number | null>(null);

  async function loadContext(lifecycleId: number) {
    let result: ApiResult<unknown>;
    try {
      result = await api.getContext(targetId);
    } catch {
      result = { ok: false, status: 0, error: { error: "Could not reach the server. Check that the app is running and try again." } };
    }
    if (lifecycleRef.current !== lifecycleId) return;
    if (!result.ok) {
      setContextState(classifyContextFailure(result.status, result.error));
      return;
    }
    if (!isReadyContextForTarget(result.data, targetId)) {
      setContextState({ kind: "ERROR", message: "The server returned confirmed information in an unexpected format." });
      return;
    }
    setContextState({ kind: "READY", context: result.data });
  }

  async function loadInitial(lifecycleId: number) {
    let saved: ApiResult<unknown>;
    try {
      saved = await api.getSaved(targetId);
    } catch {
      saved = { ok: false, status: 0, error: { error: "Could not reach the server. Check that the app is running and try again." } };
    }
    if (lifecycleRef.current !== lifecycleId) return;
    if (!saved.ok) {
      setContextState(classifyContextFailure(saved.status, saved.error));
      return;
    }
    if (saved.data !== undefined) {
      const checked = validateSavedPresentationRecord(saved.data, targetId);
      if (!checked.ok) {
        setContextState({ kind: "ERROR", message: checked.error });
        return;
      }
      setContextState({ kind: "READY", context: checked.value.sourceSnapshot });
      dispatchGeneration({ type: "LOAD", accepted: checked.value });
      return;
    }
    await loadContext(lifecycleId);
  }

  useEffect(() => {
    const lifecycleId = ++lifecycleRef.current;
    activeRequestRef.current = null;
    dispatchGeneration({ type: "RESET" });
    const beginLoad = async () => {
      await Promise.resolve();
      if (lifecycleRef.current !== lifecycleId) return;
      setContextState({ kind: "LOADING" });
      await loadInitial(lifecycleId);
    };
    void beginLoad();
    return () => {
      lifecycleRef.current += 1;
      activeRequestRef.current = null;
    };
    // `api` is stable in production; test harnesses must memoize injected clients.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, api]);

  async function startGeneration() {
    if (activeRequestRef.current !== null) return;
    const lifecycleId = lifecycleRef.current;
    const requestId = ++requestCounterRef.current;
    activeRequestRef.current = requestId;
    dispatchGeneration({ type: "BEGIN", requestId });

    const fail = (message: string) => {
      if (lifecycleRef.current !== lifecycleId || activeRequestRef.current !== requestId) return;
      activeRequestRef.current = null;
      dispatchGeneration({ type: "FAILURE", requestId, message });
    };

    let starting: ApiResult<unknown>;
    try {
      starting = await api.getContext(targetId);
    } catch {
      starting = { ok: false, status: 0, error: { error: "Could not re-check the confirmed information before generation." } };
    }
    if (lifecycleRef.current !== lifecycleId || activeRequestRef.current !== requestId) return;
    if (!starting.ok) {
      if (!generation.accepted) setContextState(classifyContextFailure(starting.status, starting.error));
      fail(starting.error.error || "The confirmed information is not ready for generation.");
      return;
    }
    if (!isReadyContextForTarget(starting.data, targetId)) {
      fail("The confirmed information returned an unexpected format.");
      return;
    }
    const startingContext = starting.data;
    const startingSnapshot = contextSnapshotKey(startingContext);
    setContextState({ kind: "READY", context: startingContext });

    let generated: ApiResult<unknown>;
    try {
      generated = await api.generate(targetId);
    } catch {
      generated = { ok: false, status: 0, error: { error: "Could not reach the generation service. No automatic retry was attempted." } };
    }
    if (lifecycleRef.current !== lifecycleId || activeRequestRef.current !== requestId) return;
    if (!generated.ok) {
      fail(generated.error.error || "The presentation could not be generated. Your previous draft, if any, was kept.");
      return;
    }

    // Re-read confirmed inputs after the paid operation. A changed context is not mixed with an older result.
    let refreshed: ApiResult<unknown>;
    try {
      refreshed = await api.getContext(targetId);
    } catch {
      refreshed = { ok: false, status: 0, error: { error: "Could not re-check the confirmed information after generation." } };
    }
    if (lifecycleRef.current !== lifecycleId || activeRequestRef.current !== requestId) return;
    if (!refreshed.ok || !isReadyContextForTarget(refreshed.data, targetId)) {
      fail("The confirmed information could not be re-checked after generation. The new result was not applied.");
      return;
    }
    if (contextSnapshotKey(refreshed.data) !== startingSnapshot) {
      setContextState({ kind: "READY", context: refreshed.data });
      fail("The confirmed CV, job or images changed during generation. The new result was not mixed with the current context.");
      return;
    }

    const checked = validateGenerationResponse(generated.data, targetId, refreshed.data);
    if (!checked.ok) {
      fail(checked.error);
      return;
    }
    setContextState({ kind: "READY", context: refreshed.data });
    activeRequestRef.current = null;
    dispatchGeneration({ type: "SUCCESS", requestId, accepted: checked.value });
  }

  async function saveDraft(draft: InterviewPresentation, expectedRevision: number) {
    const accepted = generation.accepted;
    if (!accepted) return { ok: false as const, status: 0, message: "No saved presentation is open." };
    const presentationId = accepted.response.presentationId;
    let result: ApiResult<unknown>;
    try {
      result = await api.save(targetId, presentationId, draft, expectedRevision);
    } catch {
      result = { ok: false, status: 0, error: { error: "Could not reach the server. Your local edits were kept." } };
    }
    if (!result.ok) return { ok: false as const, status: result.status, message: result.error.error || "The draft could not be saved." };
    const checked = validateSavedPresentationRecord(result.data, targetId);
    if (!checked.ok || checked.value.response.presentationId !== presentationId) {
      return { ok: false as const, status: 500, message: "The server returned an invalid saved presentation response. Your local edits were kept." };
    }
    return {
      ok: true as const,
      revision: checked.value.response.revision,
      updatedAt: checked.value.response.updatedAt,
      stale: checked.value.stale,
    };
  }

  async function exportPptx(presentationId: string, expectedRevision: number) {
    const accepted = generation.accepted;
    if (!accepted || accepted.response.presentationId !== presentationId) {
      return { ok: false as const, status: 404, error: { error: "No saved presentation is open for export." } };
    }
    try {
      return await api.exportPptx(targetId, presentationId, expectedRevision);
    } catch {
      return { ok: false as const, status: 0, error: { error: "Could not reach the export service. Your current draft was kept." } };
    }
  }

  const accepted = generation.accepted;
  if (accepted) {
    return (
      <>
        {generation.error && <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8" style={editorCssVars}><p role="alert" className={t.error}><AlertIcon className="mt-px h-4 w-4" /><span>{generation.error} The existing draft was kept.</span></p></div>}
        <PresentationEditor
          key={accepted.response.presentationId}
          variant="live"
          context={accepted.sourceSnapshot}
          original={accepted.response.presentation}
          initialDraft={accepted.draft}
          imageAnalyses={accepted.response.imageAnalyses}
          presentationId={accepted.response.presentationId}
          revision={accepted.response.revision}
          updatedAt={accepted.response.updatedAt}
          stale={accepted.stale}
          generating={generation.phase === "GENERATING"}
          referenceWarnings={accepted.referenceWarnings}
          onSave={saveDraft}
          onExport={exportPptx}
          onRegenerate={() => void startGeneration()}
        />
      </>
    );
  }

  if (contextState.kind === "LOADING") {
    return <StateShell><p role="status" className="text-sm text-(--pe-muted)">Loading confirmed CV, job and image context…</p></StateShell>;
  }
  if (contextState.kind === "NOT_FOUND") {
    return <StateShell title="Interview target not found"><p className="text-sm text-(--pe-muted)">This CV–job pairing does not exist or is no longer available.</p><Link href="/prepare" className={`${t.buttonSecondary} mt-5`}>Back to interview preparation</Link></StateShell>;
  }
  if (contextState.kind === "NOT_READY") {
    return <StateShell title="Confirm the information before generating"><p className="text-sm text-(--pe-muted)">{contextState.message}</p>{contextState.issues.length > 0 && <ul className="mt-4 space-y-2 text-sm">{contextState.issues.map((issue, index) => <li key={`${issue.code}-${issue.itemId ?? issue.section}-${index}`} className={t.warning}><WarningIcon className="mt-px h-4 w-4" /><span>{issue.message}</span></li>)}</ul>}<Link href={`/prepare/${encodeURIComponent(targetId)}`} className={`${t.buttonPrimary} mt-5`}>Return to review and confirmation</Link></StateShell>;
  }
  if (contextState.kind === "ERROR") {
    return <StateShell title="Unable to load presentation context"><p role="alert" className={t.error}><AlertIcon className="mt-px h-4 w-4" /><span>{contextState.message}</span></p><button type="button" className={`${t.buttonSecondary} mt-5`} onClick={() => { const lifecycleId = ++lifecycleRef.current; setContextState({ kind: "LOADING" }); void loadContext(lifecycleId); }}>Try loading again</button></StateShell>;
  }

  const context = contextState.context;
  return (
      <StateShell title="Interview presentation">
        <p className="text-base font-medium">{targetLabel(context)}</p>
        <div className={`${t.note} mt-5 flex gap-3 px-5 py-4 text-sm leading-relaxed`}><InfoIcon className="mt-0.5 h-4 w-4" /><div><p>The confirmed information is ready. Generation starts only when you click the button below and may incur model usage.</p><p className="mt-1 text-xs text-(--pe-muted)">No sample presentation is shown here. A successful generation saves its original and initial draft; later edits require an explicit Save.</p></div></div>
        {generation.error && <p role="alert" className={`${t.error} mt-5`}><AlertIcon className="mt-px h-4 w-4" /><span>{generation.error}</span></p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={t.buttonPrimary} onClick={() => void startGeneration()} disabled={generation.phase === "GENERATING"}>{generation.phase === "GENERATING" ? "Generating presentation…" : "Generate presentation"}</button><Link href={`/prepare/${encodeURIComponent(targetId)}`} className={t.buttonSecondary}>Back to confirmed information</Link></div>
        {generation.phase === "GENERATING" && <p role="status" className="mt-3 text-xs text-(--pe-muted)">The request is in progress. Leaving this page stops the browser from waiting, but may not cancel work already running on the server.</p>}
      </StateShell>
  );
}

function StateShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return <main className={`${t.shell} min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6`} style={editorCssVars}><section className={`${t.panel} mx-auto max-w-3xl p-6 sm:p-8`}><p className={t.eyebrow}>Interview preparation</p>{title && <h1 className={`${t.display} mt-2 mb-4`}>{title}</h1>}{children}</section></main>;
}
