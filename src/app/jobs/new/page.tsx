import type { Metadata } from "next";
import { JobEditor } from "@/components/jobs/JobEditor";

export const metadata: Metadata = { title: "Add job description" };

export default function NewJobPage() {
  return <JobEditor initialJob={null} />;
}
