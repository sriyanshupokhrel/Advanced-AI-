import "server-only";
import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { findImageRecord } from "@/lib/db/image-repository";
import { readImageFile, sha256Hex } from "@/lib/storage/image-storage";
import { analyseProjectImage, type ImageAnalysisResult } from "./image-analysis";
import { generateInterviewPresentation } from "./interview-generator";
import { selectionReport } from "./content-selector";
import { PipelineError } from "./errors";
import { MAX_PIPELINE_IMAGES, MODEL, PROMPT_VERSION, newBudget } from "./provider";
import { snapshotToken } from "./snapshot";
export async function runInterviewAIPipeline(targetId:string,expectedSnapshot?:string){
  const payload=await getInterviewPreparationPayload(targetId);
  if(!payload)throw new PipelineError(404,"TARGET_NOT_FOUND","CV–job pairing not found.");
  if(!payload.readiness.isReady)throw new PipelineError(409,"NOT_CONFIRMED","Review and confirm all sections and images before generation.");
  const token=snapshotToken(payload);
  if(!expectedSnapshot || expectedSnapshot!==token)throw new PipelineError(409,"STALE_SELECTION","Reload the selected evidence and review the current version before generating.");
  if(JSON.stringify(payload).length>140_000)throw new PipelineError(413,"AI_INPUT_LIMIT","The confirmed source is too large for AI processing. Shorten long descriptions.");
  const selected=selectionReport(payload), selectedIds=new Set(selected.selected.map(x=>x.sourceId));
  const projectImages=payload.candidate.projects.items.flatMap(project=>project.images.map(image=>({project,image})));
  const planned=projectImages.filter(x=>selectedIds.has(x.project.id)).slice(0,MAX_PIPELINE_IMAGES);
  const budget=newBudget(), startedAt=Date.now(), imageAnalyses:ImageAnalysisResult[]=[];
  for(const {project,image} of planned){
    const record=await findImageRecord(image.imageId);
    if(!record || record.cvProfileId!==payload.candidate.cvProfileId || record.projectId!==project.id)
      throw new PipelineError(409,"IMAGE_CHANGED","Image association changed. Reload and confirm again.");
    const bytes=await readImageFile(record.storedFileName);
    if(!bytes || (image.sha256 && sha256Hex(bytes)!==image.sha256))throw new PipelineError(409,"IMAGE_CHANGED","Image bytes changed or are unavailable. Replace and confirm again.");
    imageAnalyses.push(await analyseProjectImage({image,imageBytes:bytes,projectId:project.id,projectName:project.name,projectDescription:project.description,jobDescription:payload.targetJob.descriptionText},budget));
  }
  const {review,...presentation}=await generateInterviewPresentation(payload,imageAnalyses,budget);
  const latest=await getInterviewPreparationPayload(targetId);
  if(!latest || snapshotToken(latest)!==token)throw new PipelineError(409,"STALE_GENERATION","Sources changed during generation. Review the latest data and generate again.");
  return {targetId,inputSnapshot:payload,sourceSnapshot:token,selection:selected,imageAnalyses,
    omittedImages:projectImages.filter(x=>!planned.some(y=>y.image.imageId===x.image.imageId)).map(x=>({imageId:x.image.imageId,reason:"Not selected or exceeds four-image analysis limit"}))
      .concat(payload.candidate.otherImages.map(x=>({imageId:x.imageId,reason:"Not linked to a selected project"}))),
    presentation,review,generatedAt:new Date().toISOString(),metadata:{model:MODEL,promptVersion:PROMPT_VERSION,calls:budget.calls,elapsedMs:Date.now()-startedAt}};
}
export type PipelineOutput=Awaited<ReturnType<typeof runInterviewAIPipeline>>;
