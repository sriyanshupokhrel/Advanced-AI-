import type { Metadata } from "next";
import { PresentationFlow } from "@/components/presentation/PresentationFlow";

export const metadata: Metadata = { title: "Interview presentation" };
export const instant = false;

export default async function InterviewPresentationPage({ params }: PageProps<"/prepare/[id]/presentation">) {
  const { id } = await params;
  return <PresentationFlow targetId={id} />;
}
