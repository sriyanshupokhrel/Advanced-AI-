import "server-only";
import {z} from "zod";
import type { InterviewPreparationPayload } from "@/types/integration";
import { selectRelevantEvidence } from "./content-selector";
import type { ImageAnalysisResult } from "./image-analysis";
import { buildInterviewPrompt } from "./prompt-builder";
import { validatePresentation,reviewUnits,sourceRegistry, type InterviewPresentation } from "./presentation-schema";
import { type ClaimReviewResult, reviewPresentationClaims } from "./claim-review";
import { modelJson, newBudget, type CallBudget } from "./provider";
import { PipelineError } from "./errors";
export type { InterviewPresentation } from "./presentation-schema";
export function generationSchema(payload:InterviewPreparationPayload,images:ImageAnalysisResult[]){
 const known=sourceRegistry(payload,images).map(x=>x.sourceId) as [string,...string[]];
 const content=(max:number)=>z.object({text:z.string().trim().min(1).max(max),sourceIds:z.array(z.enum(known)).max(40).refine(x=>new Set(x).size===x.length)}).strict();
 return z.object({title:content(180),slides:z.array(z.object({
  role:z.enum(["introduction","evidence","closing"]),heading:content(140),bullets:z.array(content(400)).min(1).max(5),speakerNotes:content(3000),
  imageIds:z.array(z.string()).max(images.filter(x=>x.relevance==="relevant").length?2:0),
 }).strict()).min(4).max(5)}).strict();
}
export function fromGeneration(value:z.infer<ReturnType<typeof generationSchema>>):InterviewPresentation{
 const references=[{unitId:"title",sourceIds:value.title.sourceIds}];
 const slides=value.slides.map((s,i)=>{
  references.push({unitId:"slide."+i+".heading",sourceIds:s.heading.sourceIds});
  s.bullets.forEach((b,j)=>references.push({unitId:"slide."+i+".bullet."+j,sourceIds:b.sourceIds}));
  references.push({unitId:"slide."+i+".notes",sourceIds:s.speakerNotes.sourceIds});
  return {role:s.role,heading:s.heading.text,bullets:s.bullets.map(x=>x.text),speakerNotes:s.speakerNotes.text,imageIds:s.imageIds,
   sourceIds:[...new Set([s.heading,...s.bullets,s.speakerNotes].flatMap(x=>x.sourceIds))]};
 });
 const deck={title:value.title.text,slides,references};
 // IDs and aggregate citations are computed by the application, not supplied by a model.
 if(reviewUnits(deck).length!==references.length)throw new PipelineError(502,"INVALID_PRESENTATION","Incomplete content mapping.");
 return deck;
}
export async function generateInterviewPresentation(payload:InterviewPreparationPayload,images:ImageAnalysisResult[]=[],budget:CallBudget=newBudget()){
 if(!payload.readiness.isReady || payload.readiness.status!=="READY")throw new PipelineError(409,"NOT_CONFIRMED","Review and confirm all sections and images before generation.");
 const value=await modelJson({contents:buildInterviewPrompt(payload,selectRelevantEvidence(payload,12),images),config:{temperature:0.2}},generationSchema(payload,images),budget);
 const presentation=validatePresentation(payload,fromGeneration(value),images);
 let review:ClaimReviewResult;
 try { review=await reviewPresentationClaims(payload,presentation,images,budget); }
 catch(error){
   if(!(error instanceof PipelineError) || !["INCOMPLETE_REVIEW","INVALID_AI_OUTPUT"].includes(error.code))throw error;
   // Keep a structurally valid, source-linked draft usable for explicit human review.
   // Discard the invalid review entirely; never relax validateClaimReview or mark it complete.
   review={approved:false,coverageComplete:false,status:"INCOMPLETE_REVIEW",findings:[],
     limitations:"Automated review was incomplete or invalid ("+error.code+"). No model findings were accepted. Compare EVERY title, heading, bullet and notes clause with its displayed source and correct unsupported claims before use or export."};
 }
 return {...presentation,review};
}
