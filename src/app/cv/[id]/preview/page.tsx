import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CvPreview } from "@/components/cv-preview/CvPreview";
import { PrintButton } from "@/components/cv-preview/PrintButton";
import { ButtonLink } from "@/components/ui/button";
import { getCvById } from "@/lib/db/cv-repository";

export const metadata: Metadata = { title: "CV preview" };

async function PreviewLoader({ params }: { params: PageProps<"/cv/[id]/preview">["params"] }) {
  const { id } = await params;
  await connection();
  const cv = await getCvById(id);
  if (!cv) notFound();

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
        <ButtonLink href={`/cv/${cv.id}`} variant="secondary">
          ← Back to editor
        </ButtonLink>
        <PrintButton />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
        <CvPreview cv={cv} images={cv.images} />
      </div>
    </>
  );
}

export default function CvPreviewPage({ params }: PageProps<"/cv/[id]/preview">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading CV…</p>}>
        <PreviewLoader params={params} />
      </Suspense>
    </div>
  );
}
