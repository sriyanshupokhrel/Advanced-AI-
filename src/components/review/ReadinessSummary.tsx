import { REVIEW_SECTION_LABELS } from "@/lib/validation/job-schema";
import type { PayloadReadiness, ReadinessIssue } from "@/types/integration";

export const reviewAnchor = (section: ReadinessIssue["section"]) => `review-${section}`;

const sectionLabel = (section: ReadinessIssue["section"]) =>
  section === "IMAGES" ? "Other images" : REVIEW_SECTION_LABELS[section];

/**
 * Top-of-page verdict: READY, or exactly which items still need the user's
 * attention (each linked to its section below).
 */
export function ReadinessSummary({ readiness, disclaimer }: { readiness: PayloadReadiness; disclaimer: string }) {
  const blocking = readiness.issues.filter((i) => i.severity === "BLOCKING");
  const warnings = readiness.issues.filter((i) => i.severity === "WARNING");

  return (
    <section
      aria-labelledby="readiness-heading"
      className={`rounded-lg border p-4 sm:p-5 ${
        readiness.isReady ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="readiness-heading" className={`text-lg font-semibold ${readiness.isReady ? "text-green-900" : "text-amber-900"}`}>
          {readiness.isReady
            ? "Ready: everything has been reviewed and confirmed"
            : `${blocking.length} item${blocking.length === 1 ? " needs" : "s need"} your attention`}
        </h2>
        <p className="text-sm text-slate-700">
          Sections {readiness.sections.confirmed}/{readiness.sections.total} confirmed · Images{" "}
          {readiness.images.confirmed}/{readiness.images.total} confirmed
        </p>
      </div>

      {readiness.isReady ? (
        <p className="mt-1 text-sm text-green-900">
          This information can now be passed to the interview presentation step. If you edit anything, it will need
          to be confirmed again.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-amber-950">
          {blocking.map((issue, i) => (
            <li key={`${issue.code}-${issue.itemId ?? issue.section}-${i}`} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>
                <a href={`#${reviewAnchor(issue.section)}`} className="font-medium underline">
                  {sectionLabel(issue.section)}
                </a>
                : {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <details className="mt-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">
            {warnings.length} note{warnings.length === 1 ? "" : "s"} (not blocking)
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {warnings.map((issue, i) => (
              <li key={`${issue.code}-${issue.itemId ?? issue.section}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 border-t border-black/10 pt-2 text-xs text-slate-600">{disclaimer}</p>
    </section>
  );
}
