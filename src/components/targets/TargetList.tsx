import { ConfirmationBadge } from "@/components/targets/ConfirmationBadge";
import { RemoveTargetButton } from "@/components/targets/RemoveTargetButton";
import { ButtonLink } from "@/components/ui/button";
import { jobDisplayTitle } from "@/lib/cv/format";
import type { CvJobTargetDto } from "@/types/job";

export function TargetList({ targets }: { targets: CvJobTargetDto[] }) {
  if (targets.length === 0) {
    return <p className="text-sm text-slate-500">No CV–job pairings yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {targets.map((target) => (
        <li
          key={target.id}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-medium text-slate-900">
              {target.cv.fullName} <span className="text-slate-400">→</span> {jobDisplayTitle(target.job)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {target.readiness.isReady ? (
                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 ring-1 ring-inset ring-green-600/20">
                  Ready
                </span>
              ) : (
                <ConfirmationBadge status={target.confirmationStatus} />
              )}
              <span>
                Sections {target.readiness.sections.confirmed}/{target.readiness.sections.total} · Images{" "}
                {target.readiness.images.confirmed}/{target.readiness.images.total}
                {!target.readiness.isReady &&
                  ` · ${target.readiness.blockingIssues} item${target.readiness.blockingIssues === 1 ? "" : "s"} to review`}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href={`/prepare/${target.id}`}>{target.readiness.isReady ? "View" : "Review & confirm"}</ButtonLink>
            <RemoveTargetButton targetId={target.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
