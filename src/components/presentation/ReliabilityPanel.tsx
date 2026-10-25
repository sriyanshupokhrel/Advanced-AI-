import type { ReliabilityMetadata } from "@/types/reliability";
import type { InterviewPresentation } from "@/types/presentation";
import { reviewUnits } from "@/lib/ai/presentation-schema";
import { presentationTheme as t } from "./presentation-theme";

export function ReliabilityPanel({ reliability, draft, slideIndex }: {
  reliability?: ReliabilityMetadata | null; draft: InterviewPresentation; slideIndex: number;
}) {
  if (!reliability) return <p className={`${t.warning} mb-6`}>No automated review is stored for this original. Check every claim and image against the source before use. Synthetic test outputs are not model evaluations.</p>;
  const { review, original, selection } = reliability;
  const sources = new Map(reliability.sources.map(source => [source.sourceId, source]));
  const units = reviewUnits(original).filter(unit => unit.slideIndex === -1 || unit.slideIndex === slideIndex);
  const textFor = (unitId: string) => {
    if (unitId === "title") return draft.title;
    const [, index, field, bullet] = unitId.split(".");
    const slide = draft.slides[Number(index)];
    return field === "heading" ? slide.heading : field === "notes" ? slide.speakerNotes : slide.bullets[Number(bullet)];
  };
  return <section aria-label="AI reliability review" className={`${t.panel} mb-6 px-5 py-4 text-sm`}>
    <p className="font-semibold">{review.status.replaceAll("_", " ")} — generated original only</p>
    <p className="mt-2 text-xs leading-relaxed">{review.limitations}</p>
    {review.status === "NEEDS_CHANGES" && <p className={`${t.warning} mt-3`}>The model flagged unsupported wording. Correct it and independently check the complete saved draft before export.</p>}
    {!review.coverageComplete && <p className={`${t.warning} mt-3`}>Automated coverage is incomplete. No claim is automatically approved. Check every field manually, including every clause in speaker notes.</p>}
    <details className="mt-3">
      <summary className="cursor-pointer font-semibold">Field references: title and slide {slideIndex + 1}</summary>
      <ul className="mt-3 space-y-3">{units.map(unit => {
        const finding = review.findings.find(item => item.unitId === unit.unitId);
        const changed = textFor(unit.unitId) !== unit.text;
        return <li key={unit.unitId} className={`${t.card} p-3`}>
          <p className="font-semibold">{unit.unitId}{changed ? " · edited; original review does not apply" : " · original wording"}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs">Original: {unit.text}</p>
          {changed && <p className="mt-1 whitespace-pre-wrap text-xs">Current draft: {textFor(unit.unitId)}</p>}
          <p className="mt-2 text-xs">{finding ? `${finding.supported ? "Model marked supported; person must verify" : "Model flagged a problem"}: ${finding.reason}` : "No accepted model finding for this field."}</p>
          {!unit.sourceIds.length && <p className="mt-1 text-xs">No cited source. Check that this is only a section label or prospective intention.</p>}
          {unit.sourceIds.map(id => <details key={id} className="mt-2 text-xs"><summary className="cursor-pointer break-all">{id} · {sources.get(id)?.kind ?? "unknown source"}</summary><p className="mt-1 whitespace-pre-wrap break-words">{sources.get(id)?.text ?? "Source unavailable; do not treat this claim as supported."}</p></details>)}
        </li>;
      })}</ul>
    </details>
    <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Evidence selection and model usage</summary>
      <p className="mt-2">{selection.method}. {selection.warning}</p>
      {selection.zeroMatch && <p className="mt-2 font-semibold">No lexical evidence match for this job; selected records are background only.</p>}
      <p className="mt-2">Selected: {selection.selected.map(item => `${item.title} (${item.relevanceScore})`).join("; ")}</p>
      <p className="mt-2">Omitted: {selection.omitted.map(item => item.title).join("; ") || "None"}</p>
      <p className="mt-2">Job words without a lexical match: {selection.jobTermsWithoutLexicalEvidence.join(", ") || "None"}</p>
      {reliability.omittedImages.map(image => <p key={image.imageId} className="mt-1">Omitted image {image.imageId}: {image.reason}</p>)}
      <p className="mt-2">{reliability.metadata.model} · {reliability.metadata.promptVersion} · {reliability.metadata.calls} model requests</p>
    </details>
  </section>;
}
