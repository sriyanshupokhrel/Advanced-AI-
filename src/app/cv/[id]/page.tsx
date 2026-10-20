import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CvEditor } from "@/components/cv-editor/CvEditor";
import { getCvById } from "@/lib/db/cv-repository";
import { safeReturnTo } from "@/lib/navigation";

export const metadata: Metadata = { title: "Edit CV" };

type Props = PageProps<"/cv/[id]">;

async function EditorLoader({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const cv = await getCvById(id);
  if (!cv) notFound();
  return <CvEditor initialCv={cv} returnTo={safeReturnTo(query.returnTo)} />;
}

export default function EditCvPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-slate-500">Loading CV…</p>}>
      <EditorLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
