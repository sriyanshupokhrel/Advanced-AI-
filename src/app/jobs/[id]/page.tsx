import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { JobEditor } from "@/components/jobs/JobEditor";
import { getJobById } from "@/lib/db/job-repository";
import { safeReturnTo } from "@/lib/navigation";

export const metadata: Metadata = { title: "Edit job description" };

type Props = PageProps<"/jobs/[id]">;

async function JobLoader({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const job = await getJobById(id);
  if (!job) notFound();
  return <JobEditor initialJob={job} returnTo={safeReturnTo(query.returnTo)} />;
}

export default function EditJobPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-slate-500">Loading job description…</p>}>
      <JobLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
