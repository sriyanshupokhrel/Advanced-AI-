import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { JobList } from "@/components/jobs/JobList";
import { ButtonLink } from "@/components/ui/button";
import { listJobSummaries } from "@/lib/db/job-repository";

export const metadata: Metadata = { title: "Job descriptions" };

async function SavedJobs() {
  await connection();
  return <JobList jobs={await listJobSummaries()} />;
}

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job descriptions</h1>
          <p className="text-sm text-slate-500">Adverts for the roles you are preparing to interview for.</p>
        </div>
        <ButtonLink href="/jobs/new">+ Add job description</ButtonLink>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading job descriptions…</p>}>
        <SavedJobs />
      </Suspense>
    </div>
  );
}
