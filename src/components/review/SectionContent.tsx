import type { ReactNode } from "react";
import { formatDateRange, formatMonth } from "@/lib/cv/format";
import type {
  PayloadAchievement,
  PayloadCandidate,
  PayloadEducation,
  PayloadProject,
  PayloadSkill,
  PayloadTargetJob,
  PayloadWorkExperience,
} from "@/types/integration";

/*
 * Read-only renderings of the payload sections on the review page. They show
 * the payload itself (not the editor state), so the user reviews exactly what
 * will be handed over. Blank values are shown as "Not provided".
 */

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="contents">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className={value ? "whitespace-pre-line text-slate-900" : "italic text-slate-400"}>{value ?? "Not provided"}</dd>
    </div>
  );
}

const Fields = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">{children}</dl>
);

const Empty = ({ what }: { what: string }) => (
  <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">
    No {what}. If that is correct, you can confirm this section as it is.
  </p>
);

function Items<T extends { id: string }>({ items, what, render }: { items: T[]; what: string; render: (item: T) => ReactNode }) {
  if (items.length === 0) return <Empty what={what} />;
  return (
    <ol className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="py-2 first:pt-0 last:pb-0">
          {render(item)}
        </li>
      ))}
    </ol>
  );
}

const Title = ({ children, aside }: { children: ReactNode; aside?: string | null }) => (
  <div className="flex flex-wrap justify-between gap-x-3">
    <p className="font-semibold text-slate-900">{children}</p>
    {aside && <p className="text-sm text-slate-500">{aside}</p>}
  </div>
);

const Text = ({ value }: { value: string | null }) =>
  value ? <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{value}</p> : null;

export function ProfileContent({ profile }: { profile: PayloadCandidate["profile"] }) {
  return (
    <Fields>
      <Field label="Full name" value={profile.fullName} />
      <Field label="Headline" value={profile.headline} />
      <Field label="Email" value={profile.contact.email} />
      <Field label="Phone" value={profile.contact.phone} />
      <Field label="Location" value={profile.contact.location} />
      <Field label="Website" value={profile.contact.website} />
      <Field label="Summary" value={profile.professionalSummary} />
    </Fields>
  );
}

export const EducationContent = ({ items }: { items: PayloadEducation[] }) => (
  <Items
    items={items}
    what="education entries"
    render={(e) => (
      <>
        <Title aside={formatDateRange(e.startDate ?? "", e.endDate ?? "")}>
          {[e.qualification, e.fieldOfStudy].filter(Boolean).join(" — ")}
        </Title>
        <p className="text-sm text-slate-600">{[e.institution, e.grade && `Grade: ${e.grade}`].filter(Boolean).join(" · ")}</p>
        <Text value={e.description} />
      </>
    )}
  />
);

export const ExperienceContent = ({ items }: { items: PayloadWorkExperience[] }) => (
  <Items
    items={items}
    what="work experience"
    render={(e) => (
      <>
        <Title aside={formatDateRange(e.startDate, e.endDate ?? "", e.isCurrent)}>
          {e.jobTitle} at {e.employer}
        </Title>
        {e.location && <p className="text-sm text-slate-600">{e.location}</p>}
        <Text value={e.description} />
      </>
    )}
  />
);

export function SkillsContent({ items }: { items: PayloadSkill[] }) {
  if (items.length === 0) return <Empty what="skills" />;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-800">
          {s.name}
          {s.category && <span className="text-slate-500"> · {s.category}</span>}
        </li>
      ))}
    </ul>
  );
}

export const ProjectsContent = ({ items }: { items: PayloadProject[] }) => (
  <Items
    items={items}
    what="projects"
    render={(p) => (
      <>
        <Title aside={`${p.images.length} image${p.images.length === 1 ? "" : "s"}`}>{p.name}</Title>
        <p className="text-sm text-slate-600">{[p.role, p.technologies].filter(Boolean).join(" · ")}</p>
        <Text value={p.description} />
        {p.url && <p className="break-all text-sm text-indigo-700">{p.url}</p>}
      </>
    )}
  />
);

export const AchievementsContent = ({ items }: { items: PayloadAchievement[] }) => (
  <Items
    items={items}
    what="achievements"
    render={(a) => (
      <>
        <Title aside={a.date ? formatMonth(a.date) : null}>{a.title}</Title>
        {a.issuer && <p className="text-sm text-slate-600">{a.issuer}</p>}
        <Text value={a.description} />
      </>
    )}
  />
);

export function TargetJobContent({ job }: { job: PayloadTargetJob }) {
  return (
    <>
      <Fields>
        <Field label="Job title" value={job.jobTitle} />
        <Field label="Company" value={job.company.name} />
        <Field label="About company" value={job.company.information} />
        <Field label="Reference" value={job.jobReference} />
      </Fields>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-700">Job description (as pasted)</h3>
      {/* pre-wrap keeps every space and line break exactly as entered */}
      <div className="mt-1 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
        {job.descriptionText}
      </div>
    </>
  );
}
