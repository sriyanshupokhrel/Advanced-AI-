"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { DeleteJobButton } from "@/components/jobs/DeleteJobButton";
import { Button, buttonClass } from "@/components/ui/button";
import { TextAreaField, TextField, fieldId } from "@/components/ui/form-fields";
import { ReturnToReviewBanner } from "@/components/ui/ReturnToReviewBanner";
import { jobApi } from "@/lib/api/api-client";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import { JOB_DESCRIPTION_MAX_CHARS, jobDescriptionSchema } from "@/lib/validation/job-schema";
import type { FieldErrors } from "@/types/cv";
import type { JobDescriptionDto, JobDescriptionInput } from "@/types/job";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

const emptyJob: JobDescriptionInput = {
  title: "",
  companyName: "",
  companyInfo: "",
  jobReference: "",
  description: "",
};

const toInput = ({ title, companyName, companyInfo, jobReference, description }: JobDescriptionDto) => ({
  title,
  companyName,
  companyInfo,
  jobReference,
  description,
});

/** Create or edit a target job description. */
export function JobEditor({ initialJob, returnTo }: { initialJob: JobDescriptionDto | null; returnTo?: string }) {
  const [jobId, setJobId] = useState<string | null>(initialJob?.id ?? null);
  const [targetCount, setTargetCount] = useState(initialJob?.targetCount ?? 0);
  const [values, setValues] = useState<JobDescriptionInput>(initialJob ? toInput(initialJob) : emptyJob);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const setField = (field: keyof JobDescriptionInput) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
    setIsDirty(true);
    if (status.kind === "saved") setStatus({ kind: "idle" });
  };

  async function handleSave(event: FormEvent) {
    event.preventDefault();

    const parsed = jobDescriptionSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      setStatus({ kind: "error", message: "Please fix the highlighted fields before saving." });
      document.getElementById(fieldId(Object.keys(fieldErrors)[0]))?.focus();
      return;
    }

    setStatus({ kind: "saving" });
    const result = jobId ? await jobApi.update(jobId, parsed.data) : await jobApi.create(parsed.data);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setStatus({ kind: "error", message: result.error.error });
      return;
    }

    setValues(toInput(result.data));
    setTargetCount(result.data.targetCount);
    setErrors({});
    setIsDirty(false);
    setStatus({ kind: "saved", message: jobId ? "Job description updated." : "Job description saved." });
    if (!jobId) {
      setJobId(result.data.id);
      window.history.replaceState(null, "", `/jobs/${result.data.id}`);
    }
  }

  const length = values.description.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {returnTo && <ReturnToReviewBanner href={returnTo} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {jobId ? "Edit job description" : "Add a job description"}
          </h1>
          <p className="text-sm text-slate-500">
            Paste the advert for the role you are preparing for. Fields marked{" "}
            <span className="text-red-600">*</span> are required.
          </p>
        </div>
        {jobId && (
          <Link href={`/prepare?jobId=${jobId}`} className={buttonClass("secondary")}>
            Pair with a CV →
          </Link>
        )}
      </div>

      <div aria-live="polite" className="mb-4 empty:hidden">
        {status.kind === "error" && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {status.message}
          </p>
        )}
        {status.kind === "saved" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {status.message}
            {targetCount > 0 &&
              ` It is paired with ${targetCount} CV${targetCount === 1 ? "" : "s"}; any earlier confirmation of those pairs must be renewed if the content changed.`}
          </p>
        )}
        {status.kind === "idle" && isDirty && <p className="text-sm text-amber-700">You have unsaved changes.</p>}
      </div>

      <form
        onSubmit={handleSave}
        noValidate
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            path="title"
            label="Job title"
            value={values.title}
            onChange={setField("title")}
            error={errors.title}
            placeholder="e.g. Junior Data Analyst"
          />
          <TextField
            path="companyName"
            label="Company name"
            value={values.companyName}
            onChange={setField("companyName")}
            error={errors.companyName}
          />
          <TextField
            path="jobReference"
            label="Job reference"
            value={values.jobReference}
            onChange={setField("jobReference")}
            error={errors.jobReference}
            placeholder="e.g. REQ-10423"
            hint="Optional reference or requisition number from the advert."
          />
          <TextAreaField
            path="companyInfo"
            label="About the company"
            rows={2}
            value={values.companyInfo}
            onChange={setField("companyInfo")}
            error={errors.companyInfo}
            hint="Optional: industry, size, values, anything you know about them."
          />
        </div>
        <TextAreaField
          path="description"
          label="Job description"
          required
          rows={16}
          value={values.description}
          onChange={setField("description")}
          error={errors.description}
          placeholder="Paste the full job advert here, including responsibilities and requirements."
          hint={`${length.toLocaleString("en-AU")} / ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-AU")} characters. Saved exactly as pasted — nothing is reworded.`}
        />
        <div className="flex flex-wrap justify-between gap-2">
          {jobId ? (
            <DeleteJobButton
              jobId={jobId}
              jobLabel={values.title || "this job description"}
              targetCount={targetCount}
              redirectTo="/jobs"
            />
          ) : (
            <span />
          )}
          <Button type="submit" disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "Saving…" : "Save job description"}
          </Button>
        </div>
      </form>
    </div>
  );
}
