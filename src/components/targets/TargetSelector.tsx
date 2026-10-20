"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { targetApi } from "@/lib/api/api-client";
import { jobDisplayTitle } from "@/lib/cv/format";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { cvJobTargetSchema } from "@/lib/validation/job-schema";
import type { CvSummaryDto, FieldErrors } from "@/types/cv";
import type { JobDescriptionSummaryDto } from "@/types/job";

interface TargetSelectorProps {
  cvs: CvSummaryDto[];
  jobs: JobDescriptionSummaryDto[];
  /** Pre-selection from the URL (?cvId=…&jobId=…); ignored if it no longer exists. */
  initialCvId?: string;
  initialJobId?: string;
}

/** Choose one CV and one job, then open their review page. */
export function TargetSelector({ cvs, jobs, initialCvId, initialJobId }: TargetSelectorProps) {
  const router = useRouter();
  const cvFromUrl = cvs.some((cv) => cv.id === initialCvId) ? initialCvId! : "";
  const jobFromUrl = jobs.some((job) => job.id === initialJobId) ? initialJobId! : "";
  const [cvId, setCvId] = useState(cvFromUrl);
  const [jobId, setJobId] = useState(jobFromUrl);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staleLinkNotes = [
    initialCvId && !cvFromUrl && "The CV from the link you followed no longer exists. Choose another.",
    initialJobId && !jobFromUrl && "The job description from the link you followed no longer exists. Choose another.",
  ].filter(Boolean) as string[];

  if (cvs.length === 0 || jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900">
          {cvs.length === 0 && jobs.length === 0
            ? "You need a CV and a job description first"
            : cvs.length === 0
              ? "You need a CV first"
              : "You need a job description first"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Interview preparation pairs one of your CVs with the job you are applying for.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {cvs.length === 0 && <ButtonLink href="/cv/new">Create a CV</ButtonLink>}
          {jobs.length === 0 && <ButtonLink href="/jobs/new">Add a job description</ButtonLink>}
        </div>
      </div>
    );
  }

  const selectedCv = cvs.find((cv) => cv.id === cvId);
  const selectedJob = jobs.find((job) => job.id === jobId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const parsed = cvJobTargetSchema.safeParse({ cvProfileId: cvId, jobDescriptionId: jobId });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    const result = await targetApi.create(parsed.data.cvProfileId, parsed.data.jobDescriptionId);
    if (!result.ok) {
      setBusy(false);
      setErrors(result.error.fieldErrors ?? {});
      setMessage(result.error.error);
      return;
    }
    // Keep the button disabled while the review page loads.
    router.push(`/prepare/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Choose a CV and a target job</h2>
      <p className="mb-4 text-sm text-slate-500">
        You will review both before confirming that the data is ready to use.
      </p>

      {staleLinkNotes.map((note) => (
        <p key={note} className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {note}
        </p>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <SelectField
            path="cvProfileId"
            label="CV"
            required
            value={cvId}
            onChange={(value) => {
              setCvId(value);
              setErrors(({ cvProfileId: _removed, ...rest }) => rest);
            }}
            error={errors.cvProfileId}
            options={[
              { value: "", label: "Select a CV…" },
              ...cvs.map((cv) => ({ value: cv.id, label: cv.headline ? `${cv.fullName} — ${cv.headline}` : cv.fullName })),
            ]}
          />
          {selectedCv && (
            <p className="mt-2 text-xs text-slate-500" suppressHydrationWarning>
              Last updated {new Date(selectedCv.updatedAt).toLocaleString("en-AU")}
            </p>
          )}
        </div>
        <div>
          <SelectField
            path="jobDescriptionId"
            label="Target job"
            required
            value={jobId}
            onChange={(value) => {
              setJobId(value);
              setErrors(({ jobDescriptionId: _removed, ...rest }) => rest);
            }}
            error={errors.jobDescriptionId}
            options={[
              { value: "", label: "Select a job description…" },
              ...jobs.map((job) => ({
                value: job.id,
                label: job.jobReference ? `${jobDisplayTitle(job)} (${job.jobReference})` : jobDisplayTitle(job),
              })),
            ]}
          />
          {selectedJob && <p className="mt-2 line-clamp-3 text-xs text-slate-500">{selectedJob.excerpt}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Opening…" : "Review CV and job →"}
        </Button>
        {message && (
          <p role="alert" className="text-sm text-red-700">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
