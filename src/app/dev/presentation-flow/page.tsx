import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresentationFlowHarness, type PresentationFlowHarnessState } from "@/components/presentation/PresentationFlowHarness";

export const metadata: Metadata = { title: "Presentation flow test harness" };
export const instant = false;

  const states = new Set<PresentationFlowHarnessState>(["ready", "saved", "stale", "not-ready", "not-found", "generate-failure", "fail-regenerate", "save-failure", "export-failure", "conflict"]);

export default async function PresentationFlowHarnessPage({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const value = (await searchParams).state;
  const requested = typeof value === "string" && states.has(value as PresentationFlowHarnessState) ? value as PresentationFlowHarnessState : "ready";
  return <PresentationFlowHarness state={requested} />;
}
