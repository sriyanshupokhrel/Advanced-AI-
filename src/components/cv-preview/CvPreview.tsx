import { SafeImage } from "@/components/images/SafeImage";
import type { ReactNode } from "react";
import { formatDateRange, formatMonth } from "@/lib/cv/format";
import type { CvImageDto, CvInput } from "@/types/cv";

/**
 * Read-only, print-friendly rendering of a CV. Works with both saved CVs and
 * unsaved editor state (live preview), and with server or client components.
 */
interface CvPreviewProps {
  cv: CvInput;
  images?: CvImageDto[];
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-widest text-indigo-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EntryHeader({ title, subtitle, dates }: { title: string; subtitle?: string; dates?: string }) {
  return (
    <div className="flex flex-col gap-x-4 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {dates && <p className="shrink-0 text-sm text-slate-500">{dates}</p>}
    </div>
  );
}

const Paragraph = ({ text }: { text: string }) =>
  text ? <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{text}</p> : null;

/** Groups skills by category, keeping first-seen order. Uncategorised last. */
function groupSkills(skills: CvInput["skills"]) {
  const groups = new Map<string, string[]>();
  for (const skill of skills) {
    if (!skill.name.trim()) continue;
    const category = skill.category.trim();
    groups.set(category, [...(groups.get(category) ?? []), skill.name.trim()]);
  }
  return [...groups.entries()].sort(([a], [b]) => Number(a === "") - Number(b === ""));
}

export function CvPreview({ cv, images = [] }: CvPreviewProps) {
  const profilePhoto = images.find((image) => image.kind === "PROFILE_PHOTO");
  const contact = [cv.email, cv.phone, cv.location].filter(Boolean);
  const skillGroups = groupSkills(cv.skills);
  const isEmpty =
    !cv.fullName && !cv.summary && [cv.education, cv.experience, cv.skills, cv.projects, cv.achievements].every((list) => list.length === 0);

  if (isEmpty) {
    return (
      <div className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-slate-500">
        Start filling in the form — your CV preview will appear here.
      </div>
    );
  }

  return (
    <article className="p-6 text-slate-900 sm:p-8" aria-label="CV preview">
      <header className="flex items-center gap-5">
        {profilePhoto && (
          <SafeImage
            src={profilePhoto.url}
            alt={profilePhoto.altText}
            width={88}
            height={88}
            className="h-22 w-22 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{cv.fullName || "Your name"}</h1>
          {cv.headline && <p className="text-base text-slate-600">{cv.headline}</p>}
          {(contact.length > 0 || cv.website) && (
            <p className="mt-1 break-words text-sm text-slate-500">
              {contact.join(" · ")}
              {cv.website && (
                <>
                  {contact.length > 0 && " · "}
                  <a href={cv.website} className="text-indigo-700 underline" target="_blank" rel="noopener noreferrer">
                    {cv.website}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </header>

      {cv.summary && (
        <PreviewSection title="Professional summary">
          <Paragraph text={cv.summary} />
        </PreviewSection>
      )}

      {cv.experience.length > 0 && (
        <PreviewSection title="Experience">
          <div className="space-y-4">
            {cv.experience.map((job, i) => (
              <div key={job.id ?? i}>
                <EntryHeader
                  title={job.role || "Job title"}
                  subtitle={[job.employer, job.location].filter(Boolean).join(", ")}
                  dates={formatDateRange(job.startDate, job.endDate, job.isCurrent)}
                />
                <Paragraph text={job.description} />
              </div>
            ))}
          </div>
        </PreviewSection>
      )}

      {cv.education.length > 0 && (
        <PreviewSection title="Education">
          <div className="space-y-4">
            {cv.education.map((edu, i) => (
              <div key={edu.id ?? i}>
                <EntryHeader
                  title={[edu.degree, edu.fieldOfStudy].filter(Boolean).join(" — ") || "Qualification"}
                  subtitle={[edu.institution, edu.grade && `Grade: ${edu.grade}`].filter(Boolean).join(" · ")}
                  dates={formatDateRange(edu.startDate, edu.endDate)}
                />
                <Paragraph text={edu.description} />
              </div>
            ))}
          </div>
        </PreviewSection>
      )}

      {skillGroups.length > 0 && (
        <PreviewSection title="Skills">
          <dl className="space-y-1 text-sm">
            {skillGroups.map(([category, names]) => (
              <div key={category || "_other"} className="sm:flex sm:gap-2">
                {category && <dt className="font-semibold text-slate-800">{category}:</dt>}
                <dd className="text-slate-700">{names.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </PreviewSection>
      )}

      {cv.projects.length > 0 && (
        <PreviewSection title="Projects">
          <div className="space-y-4">
            {cv.projects.map((project, i) => {
              const projectImages = project.id ? images.filter((image) => image.projectId === project.id) : [];
              return (
                <div key={project.id ?? i}>
                  <EntryHeader
                    title={project.name || "Project"}
                    subtitle={[project.role, project.technologies].filter(Boolean).join(" · ")}
                  />
                  <Paragraph text={project.description} />
                  {project.url && (
                    <a
                      href={project.url}
                      className="mt-1 inline-block break-all text-sm text-indigo-700 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {project.url}
                    </a>
                  )}
                  {projectImages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {projectImages.map((image) => (
                        <figure key={image.id} className="w-40">
                          <SafeImage
                            src={image.url}
                            alt={image.altText}
                            width={160}
                            height={100}
                            className="h-25 w-40 rounded border border-slate-200 object-cover"
                          />
                          {image.caption && (
                            <figcaption className="mt-0.5 text-xs text-slate-500">{image.caption}</figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PreviewSection>
      )}

      {cv.achievements.length > 0 && (
        <PreviewSection title="Achievements">
          <div className="space-y-3">
            {cv.achievements.map((achievement, i) => (
              <div key={achievement.id ?? i}>
                <EntryHeader
                  title={achievement.title || "Achievement"}
                  subtitle={achievement.issuer}
                  dates={achievement.date ? formatMonth(achievement.date) : undefined}
                />
                <Paragraph text={achievement.description} />
              </div>
            ))}
          </div>
        </PreviewSection>
      )}
    </article>
  );
}
