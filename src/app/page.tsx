import { connection } from "next/server";
import { Suspense } from "react";
import { CvList } from "@/components/cv-list/CvList";
import { ButtonLink } from "@/components/ui/button";
import { listCvSummaries } from "@/lib/db/cv-repository";

async function SavedCvs() {
  await connection(); // read the database at request time, never at build time
  const cvs = await listCvSummaries();
  return <CvList cvs={cvs} />;
}

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My CVs</h1>
          <p className="text-sm text-slate-500">Create, edit and preview your saved CV profiles.</p>
        </div>
        <ButtonLink href="/cv/new">+ New CV</ButtonLink>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading CVs…</p>}>
        <SavedCvs />
      </Suspense>
    </div>
  );
}
