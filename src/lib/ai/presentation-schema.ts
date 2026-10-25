import { z } from "zod";
import type { InterviewPreparationPayload } from "@/types/integration";
import type { ImageAnalysisResult } from "./image-analysis";
import { allEvidence } from "./content-selector";
import { PipelineError } from "./errors";

const text = (max:number) => z.string().trim().min(1).max(max);
const ids = z.array(text(100)).max(40).refine(a=>new Set(a).size===a.length,"Duplicate IDs");
export const SlideSchema = z.object({
  role:z.enum(["introduction","evidence","closing"]),
  heading:text(140), bullets:z.array(text(400)).min(1).max(5), speakerNotes:text(3000),
  sourceIds:ids, imageIds:ids.max(2),
}).strict();
export const PresentationSchema = z.object({
  title:text(180), slides:z.array(SlideSchema).min(4).max(5),
  references:z.array(z.object({unitId:text(80),sourceIds:ids}).strict()).min(1).max(50),
}).strict();
export type InterviewPresentation = z.infer<typeof PresentationSchema>;
export interface ReviewUnit {unitId:string; slideIndex:number; text:string; sourceIds:string[]}
export function reviewUnits(deck: InterviewPresentation): ReviewUnit[] {
  const refs = new Map(deck.references.map(r=>[r.unitId,r.sourceIds]));
  const out: ReviewUnit[] = [{unitId:"title",slideIndex:-1,text:deck.title,sourceIds:refs.get("title")??[]}];
  deck.slides.forEach((s,i)=>{
    const add=(suffix:string,value:string)=>{const unitId="slide."+i+"."+suffix;out.push({unitId,slideIndex:i,text:value,sourceIds:refs.get(unitId)??[]});};
    add("heading",s.heading);s.bullets.forEach((b,j)=>add("bullet."+j,b));add("notes",s.speakerNotes);
  });return out;
}
export interface SourceRecord {sourceId:string; kind:"candidate"|"job"|"visual"; text:string; projectId?:string}
export function sourceRegistry(payload:InterviewPreparationPayload, images:ImageAnalysisResult[]=[]): SourceRecord[] {
  return [
    ...allEvidence(payload).map(x=>({sourceId:x.sourceId,kind:"candidate" as const,text:x.title+" "+x.description})),
    {sourceId:"job:"+payload.targetJob.jobDescriptionId,kind:"job" as const,text:JSON.stringify(payload.targetJob)},
    ...images.filter(x=>x.relevance==="relevant").map(x=>({sourceId:"image:"+x.imageId,kind:"visual" as const,text:x.visibleFeatures.join("; "),projectId:x.projectId})),
  ];
}
export function validatePresentation(payload:InterviewPreparationPayload, value:unknown, images:ImageAnalysisResult[]=[]): InterviewPresentation {
  const parsed=PresentationSchema.safeParse(value);
  const fail=(message:string):never=>{throw new PipelineError(502,"INVALID_PRESENTATION",message+" Review inputs and generate again.");};
  if(!parsed.success) return fail("AI presentation structure is invalid.");
  const deck=parsed.data;
  if(deck.slides[0].role!=="introduction" || deck.slides.at(-1)?.role!=="closing" || deck.slides.slice(1,-1).some(x=>x.role!=="evidence"))
    return fail("The presentation must introduce the candidate, present evidence and close with target-role fit or gaps.");
  const targetTitle=payload.targetJob.jobTitle?.trim();
  const closing=deck.slides[deck.slides.length-1];
  if(targetTitle && ![closing.heading,...closing.bullets,closing.speakerNotes].join(" ").toLowerCase().includes(targetTitle.toLowerCase()))
    return fail("The closing slide must explicitly identify the target role.");
  const units=reviewUnits(deck), expected=new Set(units.map(u=>u.unitId));
  if(deck.references.length!==expected.size || new Set(deck.references.map(r=>r.unitId)).size!==expected.size || deck.references.some(r=>!expected.has(r.unitId)))
    return fail("Every title, heading, bullet and notes field needs exactly one reference entry.");
  const sources=new Set(sourceRegistry(payload,images).map(x=>x.sourceId));
  if(deck.references.some(r=>r.sourceIds.some(id=>!sources.has(id)))) return fail("An unknown or foreign source was referenced.");
  if(!units.filter(u=>u.slideIndex===0).some(u=>u.sourceIds.includes(payload.candidate.cvProfileId))) return fail("The introduction must reference the actual profile.");
  deck.slides.forEach((slide,i)=>{
    const union=[...new Set(units.filter(u=>u.slideIndex===i).flatMap(u=>u.sourceIds))];
    if(slide.sourceIds.length!==union.length || slide.sourceIds.some(id=>!union.includes(id))) return fail("Slide citations differ from per-content citations.");
    for(const id of slide.imageIds){
      const analysis=images.find(x=>x.imageId===id && x.relevance==="relevant");
      const project=payload.candidate.projects.items.find(p=>p.id===analysis?.projectId && p.images.some(im=>im.imageId===id));
      if(!analysis || !project || !slide.sourceIds.includes(project.id)) return fail("Image is unrelated, foreign or not cited with its linked project.");
    }
  });
  return deck;
}
