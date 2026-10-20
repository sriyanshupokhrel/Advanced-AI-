import { ButtonLink } from "@/components/ui/button";
import type { CvSummaryDto } from "@/types/cv";
import { DeleteCvButton } from "./DeleteCvButton";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

export function CvList({ cvs }: { cvs: CvSummaryDto[] }) {
  if (cvs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-base font-semibold text-slate-900">No CVs yet</h2>
        <p className="mt-1 text-sm text-slate-500">Create your first CV to get started.</p>
        <ButtonLink href="/cv/new" className="mt-4">
          Create a CV
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {cvs.map((cv) => (
        <li key={cv.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{cv.fullName}</h2>
          {cv.headline && <p className="text-sm text-slate-600">{cv.headline}</p>}
          <p className="mt-1 text-xs text-slate-400">
            Last updated {dateFormat.format(new Date(cv.updatedAt))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={`/cv/${cv.id}`}>Edit</ButtonLink>
            <ButtonLink href={`/cv/${cv.id}/preview`} variant="secondary">
              Preview
            </ButtonLink>
            <ButtonLink href={`/prepare?cvId=${cv.id}`} variant="secondary">
              Pair with a job
            </ButtonLink>
            <DeleteCvButton cvId={cv.id} cvName={cv.fullName} />
          </div>
        </li>
      ))}
    </ul>
  );
}
