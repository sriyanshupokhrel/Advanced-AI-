import {reviewUnits,sourceRegistry} from "../../src/lib/ai/presentation-schema.ts";
export function testDeck(payload,images=[]){
 const c=payload.candidate,p=c.projects.items[0],skill=c.skills.items[0],ed=c.education.items[0];
 const middle=p?{text:p.description,id:p.id}:ed?{text:ed.qualification,id:ed.id}:{text:c.profile.professionalSummary,id:c.cvProfileId};
 const deck={title:c.profile.fullName,slides:[
  {role:"introduction",heading:"Introduction",bullets:[c.profile.fullName],speakerNotes:c.profile.professionalSummary,sourceIds:[c.cvProfileId],imageIds:[]},
  {role:"evidence",heading:"Skills",bullets:[skill?.name??c.profile.professionalSummary],speakerNotes:skill?.name??c.profile.professionalSummary,sourceIds:[skill?.id??c.cvProfileId],imageIds:[]},
  {role:"evidence",heading:"Project evidence",bullets:[middle.text],speakerNotes:middle.text,sourceIds:[middle.id],imageIds:images.filter(x=>x.projectId===p?.id && x.relevance==="relevant").slice(0,1).map(x=>x.imageId)},
  {role:"closing",heading:"Target role",bullets:["I would like to discuss the "+payload.targetJob.jobTitle+" role."],speakerNotes:"I would like to discuss transferable skills and the evidence gaps for this role.",sourceIds:[],imageIds:[]},
 ],references:[]};
 deck.references=reviewUnits(deck).map(u=>({unitId:u.unitId,sourceIds:u.unitId==="title"?[c.cvProfileId]:u.unitId.endsWith("heading")?[]:deck.slides[u.slideIndex].sourceIds}));
 return deck;
}
export function testReview(payload,deck,images=[]){
 const sources=sourceRegistry(payload,images);
 return {findings:reviewUnits(deck).map(u=>({unitId:u.unitId,slideIndex:u.slideIndex,claim:u.text,kind:u.sourceIds.length?"candidate":u.unitId.endsWith("heading")?"label":"intent",sourceIds:u.sourceIds,
  evidence:u.sourceIds.map(id=>({sourceId:id,quote:sources.find(x=>x.sourceId===id).text})),supported:true,reason:"Test-only review; does not establish factuality."}))};
}
