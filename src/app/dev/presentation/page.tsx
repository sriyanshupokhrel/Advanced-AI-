import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresentationEditor } from "@/components/presentation/PresentationEditor";
import { PRESENTATION_DEMO_SCENARIOS, SYNTHETIC_PRESENTATION_CONTEXT } from "@/lib/presentation/demo-data";

export const metadata: Metadata = { title: "Presentation editor demo" };

export default function PresentationDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PresentationEditor variant="demo" context={SYNTHETIC_PRESENTATION_CONTEXT} scenarios={PRESENTATION_DEMO_SCENARIOS} />;
}
