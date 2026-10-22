"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InterviewPreparationPayload } from "@/types/integration";
import type { ImageAnalysisResult } from "@/types/interview-generation";
import type { InterviewPresentation } from "@/types/presentation";
import type { DownloadResult } from "@/lib/api/api-client";
import type { PresentationDemoScenario } from "@/lib/presentation/demo-data";
import type { PresentationStaleStatus } from "@/lib/presentation/source-snapshot";
import {
  clonePresentation,
  getSlideFitWarnings,
  hasNewerEditsThanSubmittedSave,
  presentationsEqual,
  resolveSlideReferences,
  updateBullet,
  updatePresentationTitle,
  updateSlide,
  validatePresentationDraft,
} from "@/lib/presentation/editor-model";
import { AlertIcon, CheckIcon, InfoIcon, PencilIcon, WarningIcon } from "./PresentationIcons";
import { editorCssVars, presentationTheme as t } from "./presentation-theme";
import { SlidePreview } from "./SlidePreview";
import { SourcePanel } from "./SourcePanel";

type PresentationEditorProps =
  | {
      variant: "demo";
      context: InterviewPreparationPayload;
      scenarios: PresentationDemoScenario[];
    }
  | {
      variant: "live";
      context: InterviewPreparationPayload;
      original: InterviewPresentation;
      initialDraft: InterviewPresentation;
      imageAnalyses: ImageAnalysisResult[];
      presentationId: string;
      revision: number;
      updatedAt: string;
      stale: PresentationStaleStatus;
      generating: boolean;
      referenceWarnings?: string[];
      onSave: (draft: InterviewPresentation, expectedRevision: number) => Promise<
        | { ok: true; revision: number; updatedAt: string; stale: PresentationStaleStatus }
        | { ok: false; status: number; message: string }
      >;
      onExport: (presentationId: string, expectedRevision: number) => Promise<DownloadResult>;
      onRegenerate: () => void;
    };

const issueFor = (issues: ReturnType<typeof validatePresentationDraft>, path: string) =>
  issues.find((issue) => issue.path === path)?.message;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} className={t.fieldError}><AlertIcon className="mt-px h-3.5 w-3.5" /><span>{message}</span></span>;
}

export function PresentationEditor(props: PresentationEditorProps) {
  const { context } = props;
  const isDemo = props.variant === "demo";
  const firstScenario = props.variant === "demo" ? props.scenarios[0] : null;
  const initialOriginal = firstScenario?.presentation ?? (props.variant === "live" ? props.original : null);
  if (!initialOriginal) throw new Error("Presentation editor requires an original presentation.");
  const [scenarioId, setScenarioId] = useState(firstScenario?.id ?? "live");
  const initialDraft = props.variant === "live" ? props.initialDraft : initialOriginal;
  const [draft, setDraft] = useState<InterviewPresentation>(() => clonePresentation(initialDraft));
  const [savedDraft, setSavedDraft] = useState<InterviewPresentation>(() => clonePresentation(initialDraft));
  const [revision, setRevision] = useState(props.variant === "live" ? props.revision : 0);
  const [savedAt, setSavedAt] = useState(props.variant === "live" ? props.updatedAt : "");
  const [stale, setStale] = useState<PresentationStaleStatus>(() => props.variant === "live" ? props.stale : { isStale: false, reasons: [], unavailableImageIds: [] });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRequestRef = useRef(0);
  const latestDraftRef = useRef(draft);
  const [activeSlide, setActiveSlide] = useState(0);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set(stale.unavailableImageIds));
  const [restorePending, setRestorePending] = useState(false);
  const [regeneratePending, setRegeneratePending] = useState(false);
  const scenario = props.variant === "demo"
    ? props.scenarios.find((item) => item.id === scenarioId) ?? firstScenario
    : null;
  const original = scenario?.presentation ?? (props.variant === "live" ? props.original : initialOriginal);
  const imageAnalyses = props.variant === "live" ? props.imageAnalyses : [];
  const modifiedFromOriginal = !presentationsEqual(original, draft);
  const unsaved = !presentationsEqual(savedDraft, draft);
  const issues = useMemo(() => validatePresentationDraft(draft), [draft]);
  const currentSlide = draft.slides[activeSlide];
  const references = useMemo(() => resolveSlideReferences(currentSlide, context), [currentSlide, context]);
  const fitWarnings = useMemo(() => getSlideFitWarnings(currentSlide), [currentSlide]);
  const exportReferenceIssues = useMemo(() => draft.slides.flatMap((slide, index) => {
    const resolved = resolveSlideReferences(slide, context);
    const missingSources = resolved.sources.filter((item) => item.status === "MISSING").map((item) => item.id);
    const missingImages = resolved.images.filter((item) => item.status === "MISSING").map((item) => item.id);
    const webpImages = resolved.images
      .filter((item) => item.status === "FOUND" && item.value.image.mimeType === "image/webp")
      .map((item) => item.id);
    const failedImages = slide.imageIds.filter((id) => failedImageIds.has(id));
    return [
      missingSources.length ? `Slide ${index + 1} has unknown source IDs: ${missingSources.join(", ")}.` : "",
      missingImages.length ? `Slide ${index + 1} has unknown image IDs: ${missingImages.join(", ")}.` : "",
      failedImages.length ? `Slide ${index + 1} has unavailable images: ${failedImages.join(", ")}.` : "",
      webpImages.length ? `Slide ${index + 1} uses WebP images ${webpImages.join(", ")}. Convert them to PNG or JPEG, upload and confirm them again before export.` : "",
    ].filter(Boolean);
  }), [context, draft.slides, failedImageIds]);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [unsaved]);

  useEffect(() => () => {
    exportRequestRef.current += 1;
  }, []);

  function selectScenario(nextId: string) {
    if (props.variant !== "demo") return;
    const next = props.scenarios.find((item) => item.id === nextId);
    if (!next || next.id === scenarioId) return;
    if (modifiedFromOriginal && !window.confirm("Discard this session's draft changes and open the other synthetic sample?")) return;
    setScenarioId(next.id);
    const nextDraft = clonePresentation(next.presentation);
    latestDraftRef.current = nextDraft;
    setDraft(nextDraft);
    setSavedDraft(clonePresentation(next.presentation));
    setActiveSlide(0);
    setFailedImageIds(new Set());
    setRestorePending(false);
    setSaveMessage(null);
    setSaveError(null);
  }

  function editDraft(update: (current: InterviewPresentation) => InterviewPresentation) {
    setDraft((current) => {
      const next = update(current);
      latestDraftRef.current = next;
      return next;
    });
    setSaveMessage(null);
    setSaveError(null);
    setExportMessage(null);
    setExportError(null);
  }

  function requestRegeneration() {
    if (props.variant !== "live" || props.generating || saving) return;
    if (unsaved) {
      setRegeneratePending(true);
      return;
    }
    props.onRegenerate();
  }

  function confirmRegeneration() {
    if (props.variant !== "live") return;
    setRegeneratePending(false);
    props.onRegenerate();
  }

  function restoreOriginal() {
    if (!modifiedFromOriginal) return;
    const restored = clonePresentation(original);
    latestDraftRef.current = restored;
    setDraft(restored);
    setActiveSlide((index) => Math.min(index, original.slides.length - 1));
    setFailedImageIds(new Set(stale.unavailableImageIds));
    setRestorePending(false);
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveDraft() {
    if (props.variant !== "live" || saving || !unsaved) return;
    const submittedDraft = clonePresentation(draft);
    const submittedRevision = revision;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const result = await props.onSave(submittedDraft, submittedRevision);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    // If the user typed during the request, only the submitted snapshot is marked saved.
    setSavedDraft(submittedDraft);
    setRevision(result.revision);
    setSavedAt(result.updatedAt);
    setStale(result.stale);
    setFailedImageIds((current) => new Set([...current, ...result.stale.unavailableImageIds]));
    setSaveMessage(hasNewerEditsThanSubmittedSave(latestDraftRef.current, submittedDraft) ? "Earlier edits saved; newer changes are still unsaved." : "Draft saved.");
  }

  function exportBlockReasons() {
    if (props.variant !== "live") return ["PPTX export is available only for a saved presentation."];
    const reasons: string[] = [];
    if (unsaved) reasons.push("Save the current wording before downloading; export never saves automatically.");
    if (saving) reasons.push("Wait for the current Save to finish.");
    if (props.generating) reasons.push("Wait for generation to finish.");
    if (issues.some((issue) => issue.severity === "ERROR")) reasons.push("Complete the highlighted title, headings and bullets, then Save.");
    if (stale.isStale) reasons.push("Review and confirm the changed source information, then explicitly generate and save again.");
    if (props.referenceWarnings?.length) reasons.push("Resolve the source or image reference warnings before export.");
    reasons.push(...exportReferenceIssues);
    return [...new Set(reasons)];
  }

  function requestExport() {
    if (props.variant !== "live" || exporting) return;
    const reasons = exportBlockReasons();
    if (reasons.length) {
      setExportError(reasons.join(" "));
      setExportPending(false);
      return;
    }
    setExportError(null);
    setExportPending(true);
  }

  async function confirmExport() {
    if (props.variant !== "live" || exporting) return;
    const reasons = exportBlockReasons();
    if (reasons.length) {
      setExportPending(false);
      setExportError(reasons.join(" "));
      return;
    }
    const submittedRevision = revision;
    const requestId = ++exportRequestRef.current;
    setExportPending(false);
    setExporting(true);
    setExportError(null);
    setExportMessage(`Building saved revision ${submittedRevision}… edits made now will not be included until they are saved and exported again.`);
    const result = await props.onExport(props.presentationId, submittedRevision);
    if (exportRequestRef.current !== requestId) return;
    setExporting(false);
    if (!result.ok) {
      setExportMessage(null);
      setExportError(result.error.error || "PPTX export failed. The current draft was kept.");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setExportMessage(`Downloaded saved revision ${result.revision}. This does not mark edited wording as semantically reviewed.`);
  }

  const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
  const titleError = issueFor(issues, "title");
  const headingError = issueFor(issues, `slides.${activeSlide}.heading`);
  const slideHasIssue = (index: number) => issues.some((issue) => issue.path.startsWith(`slides.${index}.`));

  return (
    <div className={`${t.shell} flex-1`} style={editorCssVars}>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className={t.eyebrow}>{isDemo ? "Development preview" : "Generated presentation"}</p>
            <h1 className={`${t.display} mt-2`}>Interview presentation editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className={t.statusPill}>
              {unsaved ? <PencilIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
              {isDemo ? (modifiedFromOriginal ? "Unsaved session changes" : "Original sample") : unsaved ? "Unsaved changes" : modifiedFromOriginal ? "Saved user edits" : "Saved generated original"}
            </span>
            {props.variant === "live" && <button type="button" className={t.buttonPrimary} onClick={() => void saveDraft()} disabled={!unsaved || saving || props.generating}>{saving ? "Saving…" : "Save"}</button>}
            {props.variant === "live" && <button type="button" className={t.buttonSecondary} onClick={requestExport} disabled={exporting || saving || props.generating}>{exporting ? `Exporting revision ${revision}…` : "Download PPTX"}</button>}
            {props.variant === "live" && <button type="button" className={t.buttonPrimary} onClick={requestRegeneration} disabled={props.generating || saving || regeneratePending}>{props.generating ? "Generating…" : "Generate again"}</button>}
            <button type="button" className={t.buttonSecondary} onClick={() => setRestorePending(true)} disabled={!modifiedFromOriginal || restorePending || (props.variant === "live" && (props.generating || saving))}>Restore original</button>
          </div>
        </header>

        {restorePending && (
          <div role="alert" className={`${t.panel} mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
            <p className="flex items-start gap-2 text-sm"><WarningIcon className="mt-0.5 h-4 w-4" /><span>Restore the original {isDemo ? "synthetic sample" : "generated presentation"}? Session edits will be lost.</span></p>
            <div className="flex gap-2"><button type="button" className={t.buttonGhost} onClick={() => setRestorePending(false)}>Keep editing</button><button type="button" className={t.buttonPrimary} onClick={restoreOriginal}>Confirm restore</button></div>
          </div>
        )}

        {exportPending && props.variant === "live" && (
          <div role="alert" className={`${t.panel} mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
            <div className="max-w-3xl text-sm leading-relaxed"><p className="flex items-start gap-2"><InfoIcon className="mt-0.5 h-4 w-4" /><span><strong>Export saved revision {revision}?</strong> The PPTX will use the last successfully saved draft, not the generated original.</span></p><p className={`mt-1 pl-6 text-xs ${t.muted}`}>Your confirmation means you checked the content; it is not AI or independent fact verification.</p></div>
            <div className="flex gap-2"><button type="button" className={t.buttonGhost} onClick={() => setExportPending(false)}>Cancel</button><button type="button" className={t.buttonPrimary} onClick={() => void confirmExport()}>Confirm download</button></div>
          </div>
        )}

        {props.variant === "live" && stale.isStale && <div role="status" className={`${t.warning} mb-6`}><WarningIcon className="mt-px h-4 w-4" /><div><p className="font-semibold">Source changed — this saved presentation is based on an older confirmed snapshot.</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs">{stale.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="mt-1 text-xs">Saving wording does not clear this status. Generate again only after reviewing and confirming the current information.</p></div></div>}
        {props.variant === "live" && saveError && <p role="alert" className={`${t.error} mb-6`}><AlertIcon className="mt-px h-4 w-4" /><span>{saveError}</span></p>}
        {props.variant === "live" && saveMessage && <p role="status" className={`${t.note} mb-6 px-4 py-3 text-sm`}>{saveMessage}</p>}
        {props.variant === "live" && exportError && <p role="alert" className={`${t.error} mb-6`}><AlertIcon className="mt-px h-4 w-4" /><span>{exportError}</span></p>}
        {props.variant === "live" && exportMessage && <p role="status" className={`${t.note} mb-6 px-4 py-3 text-sm`}>{exportMessage}</p>}

        {regeneratePending && props.variant === "live" && (
          <div role="alert" className={`${t.panel} mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
            <p className="flex items-start gap-2 text-sm"><WarningIcon className="mt-0.5 h-4 w-4" /><span>Generate again? Your unsaved edits will be replaced only if the new generation succeeds.</span></p>
            <div className="flex gap-2"><button type="button" className={t.buttonGhost} onClick={() => setRegeneratePending(false)}>Keep editing</button><button type="button" className={t.buttonPrimary} onClick={confirmRegeneration}>Confirm generation</button></div>
          </div>
        )}

        <section aria-label="About this demo" className={`${t.note} mb-6 flex gap-3 px-5 py-4`}>
          <InfoIcon className="mt-0.5 h-4 w-4" />
          <div className="min-w-0 space-y-1 text-sm leading-relaxed">
            <p>{isDemo ? <><strong className="font-semibold">Demo / synthetic data — no AI call.</strong>{" "}<strong className="font-semibold">Changes are not saved:</strong> they stay in this page session.</> : <><strong className="font-semibold">Explicit save only.</strong> Unsaved changes are lost on refresh or navigation; saved drafts reopen from the server.</>}</p>
            {!isDemo && <p><strong className="font-semibold">Current target:</strong> {context.candidate.profile.fullName} → {context.targetJob.jobTitle ?? "Untitled job"}{context.targetJob.company.name ? ` at ${context.targetJob.company.name}` : ""}.</p>}
            {props.variant === "live" && <p className="text-xs text-(--pe-muted)">Presentation {props.presentationId} · revision {revision} · last saved {new Date(savedAt).toLocaleString()}</p>}
            <p className="text-xs text-(--pe-warning-text)">Edited wording has not been semantically re-reviewed; source and image IDs stay read-only and do not prove an edited claim. Images are user-uploaded and unverified. {context.verificationDisclaimer}</p>
            {props.variant === "live" && props.referenceWarnings && props.referenceWarnings.length > 0 && <p className="text-xs font-semibold text-(--pe-error)">{props.referenceWarnings.join(" ")}</p>}
          </div>
        </section>

        {props.variant === "demo" && scenario && <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-2">
          <label className={`${t.label} w-full sm:w-72`}>Demo sample<select value={scenarioId} onChange={(event) => selectScenario(event.target.value)} className={`${t.input} ${t.focus} mt-1.5`}>{props.scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <p className={`pb-2 text-xs leading-relaxed ${t.muted}`}>{scenario.description}</p>
        </div>}

        <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
          <nav aria-label="Slide list" className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between px-1"><h2 className={t.sectionTitle}>Slides</h2><span className={`text-xs ${t.muted}`}>{draft.slides.length} total</span></div>
            <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 xl:flex-col xl:overflow-visible xl:pb-0">
              {draft.slides.map((slide, index) => {
                const active = activeSlide === index;
                const hasIssue = slideHasIssue(index);
                return (
                  <li key={index} className="w-52 shrink-0 xl:w-auto">
                    <button type="button" aria-current={active ? "page" : undefined} onClick={() => setActiveSlide(index)} className={`${t.focus} relative block h-full w-full overflow-hidden rounded-xl py-3 pr-3 pl-4 text-left transition ${active ? "bg-(--pe-raised) shadow-(--pe-shadow-soft)" : "hover:bg-(--pe-panel)"}`}>
                      {active && <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${t.accentBar}`} />}
                      <span className={`flex items-center justify-between gap-2 text-xs ${t.muted}`}><span className="tabular-nums">Slide {index + 1}</span>{active && <span className="font-semibold text-(--pe-text)">Editing</span>}</span>
                      <span className={`mt-1 block text-sm leading-snug break-words ${active ? "font-semibold" : "font-medium"}`}>{slide.heading || "Untitled slide"}</span>
                      <span className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-xs ${t.muted}`}>{slide.imageIds.length ? `${slide.imageIds.length} image` : "Text only"}{hasIssue && <span className="inline-flex items-center gap-1 font-semibold text-(--pe-error)"><AlertIcon className="h-3.5 w-3.5" />Needs attention</span>}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="min-w-0 space-y-4">
            <div className="flex items-baseline justify-between px-1"><h2 className={t.sectionTitle}>Preview</h2><span className={`text-xs tabular-nums ${t.muted}`}>Slide {activeSlide + 1} of {draft.slides.length}</span></div>
            <SlidePreview presentationTitle={draft.title} slide={currentSlide} slideNumber={activeSlide + 1} totalSlides={draft.slides.length} images={references.images} failedImageIds={failedImageIds} onImageError={(imageId) => setFailedImageIds((current) => new Set(current).add(imageId))} synthetic={isDemo} />
            {fitWarnings.length > 0 && <div role="status" className={t.warning}><WarningIcon className="mt-px h-4 w-4" /><span><span className="font-semibold">Fit warning.</span> {fitWarnings.join(" ")}</span></div>}
            <div className="pt-2"><SourcePanel references={references} disclaimer={context.verificationDisclaimer} imageAnalyses={imageAnalyses} unavailableImageIds={stale.unavailableImageIds} /></div>
          </div>

          <aside className={`${t.panel} h-fit p-5`} aria-label="Presentation fields">
            <div className="mb-5"><h2 className={t.sectionTitle}>Edit draft</h2><p className={`mt-1 text-xs leading-relaxed ${t.muted}`}>Wording only. Edits are not semantically re-reviewed; reference IDs are read-only.</p></div>
            <div className="space-y-5">
              <label className={t.label}>Presentation title<input value={draft.title} onChange={(event) => editDraft((current) => updatePresentationTitle(current, event.target.value))} className={`${t.input} mt-1.5`} aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "presentation-title-error" : undefined} /><FieldError id="presentation-title-error" message={titleError} /></label>
              <div className="border-t border-(--pe-border) pt-5">
                <p className={`${t.eyebrow} mb-3 flex items-center gap-2`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.accentBar}`} />Slide {activeSlide + 1}</p>
                <label className={t.label}>Heading<input value={currentSlide.heading} onChange={(event) => editDraft((current) => updateSlide(current, activeSlide, { heading: event.target.value }))} className={`${t.input} mt-1.5`} aria-invalid={Boolean(headingError)} aria-describedby={headingError ? "slide-heading-error" : undefined} /><FieldError id="slide-heading-error" message={headingError} /></label>
              </div>
              <fieldset className="space-y-3"><legend className={`${t.label} mb-2`}>Bullets</legend>{currentSlide.bullets.map((bullet, index) => { const path = `slides.${activeSlide}.bullets.${index}`; const error = issueFor(issues, path); const errorId = `bullet-${index}-error`; return <label key={index} className={`block text-xs font-medium ${t.muted}`}>Bullet {index + 1}<textarea value={bullet} rows={2} onChange={(event) => editDraft((current) => updateBullet(current, activeSlide, index, event.target.value))} className={`${t.input} mt-1 resize-y`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /><FieldError id={errorId} message={error} /></label>; })}</fieldset>
              <label className={`${t.label} border-t border-(--pe-border) pt-5`}>Speaker notes<textarea value={currentSlide.speakerNotes} rows={6} onChange={(event) => editDraft((current) => updateSlide(current, activeSlide, { speakerNotes: event.target.value }))} className={`${t.input} mt-1.5 resize-y`} aria-describedby="speaker-notes-help" /><span id="speaker-notes-help" className={t.helper}>Notes are editable but never shown inside the slide preview.</span></label>
              {issues.length > 0 && <div role="status" className={t.error}><AlertIcon className="mt-px h-4 w-4 text-(--pe-error)" /><span><span className="font-semibold">Draft has {errorCount} incomplete field(s).</span> Editing remains enabled.</span></div>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
