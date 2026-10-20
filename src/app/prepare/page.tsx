import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { TargetList } from "@/components/targets/TargetList";
import { TargetSelector } from "@/components/targets/TargetSelector";
import { listCvSummaries } from "@/lib/db/cv-repository";
import { listJobSummaries } from "@/lib/db/job-repository";
import { listTargets } from "@/lib/db/target-repository";

export const metadata: Metadata = { title: "Prepare for an interview" };

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function PrepareContent({ searchParams }: { searchParams: PageProps<"/prepare">["searchParams"] }) {
  const query = await searchParams;
  await connection();
  const [cvs, jobs, targets] = await Promise.all([listCvSummaries(), listJobSummaries(), listTargets()]);

  return (
    <div className="space-y-8">
      <TargetSelector
        cvs={cvs}
        jobs={jobs}
        initialCvId={firstValue(query.cvId)}
        initialJobId={firstValue(query.jobId)}
      />
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Saved pairings</h2>
        <TargetList targets={targets} />
      </section>
    </div>
  );
}

export default function PreparePage({ searchParams }: PageProps<"/prepare">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Prepare for an interview</h1>
        <p className="text-sm text-slate-500">
          Pair a CV with the job you are applying for, review both, and confirm the data is correct.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading your CVs and jobs…</p>}>
        <PrepareContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
