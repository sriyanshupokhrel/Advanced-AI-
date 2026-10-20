import type { Metadata } from "next";
import { CvEditor } from "@/components/cv-editor/CvEditor";

export const metadata: Metadata = { title: "New CV" };

export default function NewCvPage() {
  return <CvEditor initialCv={null} />;
}
