import type { ResolvedSlideReferences } from "@/lib/presentation/editor-model";
import type { ImageAnalysisResult } from "@/types/interview-generation";
import { AlertIcon, ChevronIcon, ImageIcon } from "./PresentationIcons";
import { presentationTheme } from "./presentation-theme";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function SourcePanel({ references, disclaimer, imageAnalyses = [], unavailableImageIds = [] }: { references: ResolvedSlideReferences; disclaimer: string; imageAnalyses?: ImageAnalysisResult[]; unavailableImageIds?: string[] }) {
  const missingCount = [...references.sources, ...references.images].filter((reference) => reference.status === "MISSING").length;
  const analysesByImage = new Map(imageAnalyses.map((analysis) => [analysis.imageId, analysis]));
  return (
    <details className={`${presentationTheme.panel} group`}>
      <summary className={`${presentationTheme.focus} flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden`}>
        <ChevronIcon className="h-4 w-4 text-(--pe-muted) transition-transform group-open:rotate-90" />
        <span className="text-sm font-semibold">Sources used on this slide</span>
        <span className={`text-xs ${presentationTheme.muted}`}>{plural(references.sources.length, "CV source")} · {plural(references.images.length, "image")}</span>
        {missingCount > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-(--pe-error)"><AlertIcon className="h-3.5 w-3.5" />{missingCount} unknown</span>}
      </summary>
      <div className="px-5 pb-5">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className={presentationTheme.eyebrow}>CV evidence</h3>
            <ul className="mt-3 space-y-2">
              {references.sources.length === 0 && <li className={`text-sm ${presentationTheme.muted}`}>No CV source IDs.</li>}
              {references.sources.map((source) => source.status === "FOUND" ? (
                <li key={source.id} className={`${presentationTheme.card} p-3 text-sm`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="font-semibold">{source.value.title}</span><span className={`text-xs uppercase tracking-[0.08em] ${presentationTheme.muted}`}>{source.value.type}</span></div>
                  <p className={`mt-1 text-xs leading-relaxed ${presentationTheme.muted}`}>{source.value.description}</p>
                  <code className={`mt-2 block text-xs break-all ${presentationTheme.muted}`}>{source.id}</code>
                </li>
              ) : (
                <li key={source.id} className={presentationTheme.error}><AlertIcon className="mt-px h-4 w-4 text-(--pe-error)" /><span><span className="font-semibold">Unknown source ID:</span> <code className="break-all">{source.id}</code></span></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className={presentationTheme.eyebrow}>Image evidence</h3>
            <ul className="mt-3 space-y-2">
              {references.images.length === 0 && <li className={`text-sm ${presentationTheme.muted}`}>No image IDs.</li>}
              {references.images.map((image) => {
                if (image.status === "MISSING") return <li key={image.id} className={presentationTheme.error}><AlertIcon className="mt-px h-4 w-4 text-(--pe-error)" /><span><span className="font-semibold">Unknown image ID:</span> <code className="break-all">{image.id}</code></span></li>;
                const analysis = analysesByImage.get(image.id);
                const unavailable = unavailableImageIds.includes(image.id);
                return (
                  <li key={image.id} className={`${presentationTheme.card} p-3 text-sm`}>
                    <p className="font-semibold">{image.value.projectName}</p>
                    <p className={`mt-1 text-xs leading-relaxed ${presentationTheme.muted}`}>{image.value.image.description.altText}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium"><ImageIcon className="h-3.5 w-3.5" />User-uploaded, unverified</p>
                    <code className={`mt-0.5 block text-xs ${presentationTheme.muted}`}>USER_UPLOADED_UNVERIFIED</code>
                    <code className={`mt-2 block text-xs break-all ${presentationTheme.muted}`}>{image.id}</code>
                    {unavailable && <p className={`${presentationTheme.error} mt-2`}><AlertIcon className="mt-px h-4 w-4" /><span>The original image bytes are no longer available at this ID; a replacement is not shown as the old source.</span></p>}
                    {analysis && <details className="mt-3 border-t border-(--pe-border) pt-3 text-xs"><summary className="cursor-pointer font-semibold">AI image analysis</summary><div className={`mt-2 space-y-2 leading-relaxed ${presentationTheme.muted}`}><p><span className="font-medium text-(--pe-text)">Generated caption:</span> {analysis.presentationCaption}</p>{analysis.visibleFeatures.length > 0 && <p><span className="font-medium text-(--pe-text)">Visible observations:</span> {analysis.visibleFeatures.join("; ")}</p>}{analysis.relevantSkills.length > 0 && <p><span className="font-medium text-(--pe-text)">Suggested relevant skills:</span> {analysis.relevantSkills.join("; ")} <strong className="font-semibold text-(--pe-error)">AI suggestion only — not a confirmed personal skill.</strong></p>}{analysis.limitations.length > 0 && <p><span className="font-medium text-(--pe-text)">Limitations:</span> {analysis.limitations.join("; ")}</p>}</div></details>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p className={`mt-5 border-t border-(--pe-border) pt-4 text-xs leading-relaxed ${presentationTheme.muted}`}>{disclaimer} A valid reference ID does not prove that edited wording is supported.</p>
      </div>
    </details>
  );
}
