import { createHash } from "node:crypto";
import type { InterviewPreparationPayload } from "@/types/integration";
export function snapshotToken(p:InterviewPreparationPayload):string{
  const images=[...p.candidate.projects.items.flatMap(x=>x.images),...p.candidate.otherImages];
  return createHash("sha256").update(JSON.stringify({targetId:p.targetId,cv:p.candidate.cvProfileId,job:p.targetJob.jobDescriptionId,
    fingerprints:p.fingerprints,ready:p.readiness.isReady,images:images.map(x=>({id:x.imageId,sha:x.sha256,url:x.url,description:x.description,updatedAt:x.updatedAt,confirmed:x.confirmation.isConfirmed,available:x.fileAvailable}))})).digest("hex");
}
