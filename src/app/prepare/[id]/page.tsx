import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConfirmRemainingPanel } from "@/components/review/ConfirmRemainingPanel";
import { ReadinessSummary, reviewAnchor } from "@/components/review/ReadinessSummary";
import { ReviewImageList } from "@/components/review/ReviewImageList";
import { ReviewSectionCard } from "@/components/review/ReviewSectionCard";
import {
  AchievementsContent,
  EducationContent,
  ExperienceContent,
  ProfileContent,
  ProjectsContent,
  SkillsContent,
  TargetJobContent,
} from "@/components/review/SectionContent";
import { RemoveTargetButton } from "@/components/targets/RemoveTargetButton";
import { ButtonLink } from "@/components/ui/button";
import { getCvById } from "@/lib/db/cv-repository";
import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { REVIEW_SECTIONS } from "@/lib/validation/job-schema";

export const metadata: Metadata = { title: "Review and confirm" };

async function ReviewContent({ params }: { params: PageProps<"/prepare/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const payload = await getInterviewPreparationPayload(id);
  if (!payload) notFound();
  const cv = await getCvById(payload.candidate.cvProfileId);
  if (!cv) notFound();

  const { candidate, targetJob, fingerprints, readiness } = payload;
  const returnTo = encodeURIComponent(`/prepare/${id}`);
  const editCv = (anchor: string) => `/cv/${cv.id}?returnTo=${returnTo}#${anchor}`;
  const sectionConfirmations = {
    PROFILE: candidate.profile.confirmation,
    EDUCATION: candidate.education.confirmation,
    EXPERIENCE: candidate.workExperience.confirmation,
    SKILLS: candidate.skills.confirmation,
    PROJECTS: candidate.projects.confirmation,
    ACHIEVEMENTS: candidate.achievements.confirmation,
    TARGET_JOB: targetJob.confirmation,
  };
  const pending = REVIEW_SECTIONS.filter((s) => !sectionConfirmations[s].isConfirmed).map((section) => ({
    section,
    fingerprint: fingerprints[section],
  }));
  const savedProjects = cv.projects.map((p) => ({ id: p.id, name: p.name }));
  const projectImages = cv.images.filter((i) => i.projectId && savedProjects.some((p) => p.id === i.projectId));
  const otherImages = cv.images.filter((i) => !projectImages.includes(i));
  const card = { targetId: id };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review and confirm</h1>
          <p className="text-sm text-slate-500">
            {candidate.profile.fullName} → {targetJob.jobTitle ?? "Untitled job"}
            {targetJob.company.name && ` at ${targetJob.company.name}`}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Check each section below. Use <strong>Correct / edit</strong> to fix anything, then confirm it. Edited
            sections must be confirmed again.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/api/targets/${id}/context`} variant="secondary" target="_blank" prefetch={false}>
            View integration payload (JSON)
          </ButtonLink>
          <RemoveTargetButton targetId={id} redirectTo="/prepare" />
        </div>
      </div>

      <div className="space-y-5">
        <ReadinessSummary readiness={readiness} disclaimer={payload.verificationDisclaimer} />

        <ReviewSectionCard {...card} section="PROFILE" confirmation={candidate.profile.confirmation} fingerprint={fingerprints.PROFILE} editHref={editCv("profile")}>
          <ProfileContent profile={candidate.profile} />
        </ReviewSectionCard>
        <ReviewSectionCard {...card} section="EXPERIENCE" confirmation={candidate.workExperience.confirmation} fingerprint={fingerprints.EXPERIENCE} editHref={editCv("experience")}>
          <ExperienceContent items={candidate.workExperience.items} />
        </ReviewSectionCard>
        <ReviewSectionCard {...card} section="EDUCATION" confirmation={candidate.education.confirmation} fingerprint={fingerprints.EDUCATION} editHref={editCv("education")}>
          <EducationContent items={candidate.education.items} />
        </ReviewSectionCard>
        <ReviewSectionCard {...card} section="SKILLS" confirmation={candidate.skills.confirmation} fingerprint={fingerprints.SKILLS} editHref={editCv("skills")}>
          <SkillsContent items={candidate.skills.items} />
        </ReviewSectionCard>
        <ReviewSectionCard {...card} section="PROJECTS" confirmation={candidate.projects.confirmation} fingerprint={fingerprints.PROJECTS} editHref={editCv("projects")}>
          <ProjectsContent items={candidate.projects.items} />
          {projectImages.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="text-sm font-semibold text-slate-700">Project images</h3>
              <p className="text-xs text-slate-500">
                Confirm each image separately: check the description is accurate and the image belongs to the named
                project. Confirming the project text above does not confirm its images.
              </p>
              <ReviewImageList cvId={cv.id} images={projectImages} projects={savedProjects} />
            </div>
          )}
        </ReviewSectionCard>
        <ReviewSectionCard {...card} section="ACHIEVEMENTS" confirmation={candidate.achievements.confirmation} fingerprint={fingerprints.ACHIEVEMENTS} editHref={editCv("achievements")}>
          <AchievementsContent items={candidate.achievements.items} />
        </ReviewSectionCard>

        {otherImages.length > 0 && (
          <section id={reviewAnchor("IMAGES")} className="scroll-mt-4 rounded-lg border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">Other images</h2>
            <p className="text-xs text-slate-500">
              Profile photo, certificates and other images not linked to a project. Each must be confirmed (or deleted).
            </p>
            <ReviewImageList cvId={cv.id} images={otherImages} projects={savedProjects} />
          </section>
        )}

        <ReviewSectionCard
          {...card}
          section="TARGET_JOB"
          confirmation={targetJob.confirmation}
          fingerprint={fingerprints.TARGET_JOB}
          editHref={`/jobs/${targetJob.jobDescriptionId}?returnTo=${returnTo}`}
        >
          <TargetJobContent job={targetJob} />
        </ReviewSectionCard>

        <ConfirmRemainingPanel
          targetId={id}
          pending={pending}
          pendingImages={readiness.images.total - readiness.images.confirmed}
        />
      </div>
    </>
  );
}

export default function ReviewTargetPage({ params }: PageProps<"/prepare/[id]">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading CV and job…</p>}>
        <ReviewContent params={params} />
      </Suspense>
    </div>
  );
}
