import { ButtonLink } from "@/components/ui/button";
import { jobDisplayTitle } from "@/lib/cv/format";
import type { JobDescriptionSummaryDto } from "@/types/job";
import { DeleteJobButton } from "./DeleteJobButton";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

export function JobList({ jobs }: { jobs: JobDescriptionSummaryDto[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-base font-semibold text-slate-900">No job descriptions yet</h2>
        <p className="mt-1 text-sm text-slate-500">Paste the advert for a role you want to prepare for.</p>
        <ButtonLink href="/jobs/new" className="mt-4">
          Add a job description
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {jobs.map((job) => (
        <li key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{jobDisplayTitle(job)}</h2>
          <p className="text-xs text-slate-400">
            {job.jobReference && <>Ref: {job.jobReference} · </>}
            Updated {dateFormat.format(new Date(job.updatedAt))} · Paired with {job.targetCount} CV
            {job.targetCount === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-sm text-slate-600">{job.excerpt}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={`/jobs/${job.id}`}>View / edit</ButtonLink>
            <ButtonLink href={`/prepare?jobId=${job.id}`} variant="secondary">
              Pair with a CV
            </ButtonLink>
            <DeleteJobButton jobId={job.id} jobLabel={jobDisplayTitle(job)} targetCount={job.targetCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}
