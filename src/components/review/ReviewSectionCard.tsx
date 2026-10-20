import Link from "next/link";
import type { ReactNode } from "react";
import { reviewAnchor } from "@/components/review/ReadinessSummary";
import { SectionConfirmButton } from "@/components/review/SectionConfirmButton";
import { ConfirmationBadge } from "@/components/targets/ConfirmationBadge";
import { REVIEW_SECTION_LABELS, type ReviewSection } from "@/lib/validation/job-schema";
import type { SectionConfirmation } from "@/types/integration";

interface ReviewSectionCardProps {
  targetId: string;
  section: ReviewSection;
  confirmation: SectionConfirmation;
  fingerprint: string;
  /** Where the user corrects this section. */
  editHref: string;
  children: ReactNode;
}

const dateTime = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

/** One reviewable section: its content, status and confirm/edit actions. */
export function ReviewSectionCard({ targetId, section, confirmation, fingerprint, editHref, children }: ReviewSectionCardProps) {
  const border =
    confirmation.status === "CONFIRMED"
      ? "border-green-300"
      : confirmation.status === "CHANGED_SINCE_CONFIRMATION"
        ? "border-amber-400"
        : "border-slate-200";

  return (
    <section
      id={reviewAnchor(section)}
      aria-labelledby={`${reviewAnchor(section)}-heading`}
      className={`scroll-mt-4 rounded-lg border-2 bg-white p-4 shadow-sm sm:p-5 ${border}`}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${reviewAnchor(section)}-heading`} className="text-base font-semibold text-slate-900">
            {REVIEW_SECTION_LABELS[section]}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <ConfirmationBadge status={confirmation.status} />
            {confirmation.confirmedAt && confirmation.status === "CONFIRMED" && (
              <span>Confirmed {dateTime.format(new Date(confirmation.confirmedAt))}</span>
            )}
            {confirmation.status === "CHANGED_SINCE_CONFIRMATION" && (
              <span className="text-amber-800">Edited after you confirmed it. Please review again.</span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Link href={editHref} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
            Correct / edit
          </Link>
          <SectionConfirmButton targetId={targetId} section={section} status={confirmation.status} fingerprint={fingerprint} />
        </div>
      </header>
      {children}
    </section>
  );
}
