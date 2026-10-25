import type { InterviewPreparationPayload } from "@/types/integration";
export interface SelectedEvidence {
  sourceId: string;
  sourceType: "profile" | "skill" | "experience" | "project" | "education" | "achievement";
  title: string; description: string; relevanceScore: number; imageIds: string[];
}
const STOP = new Set("the and for with from that this you will your are our have about work role join into used using requires required responsibilities graduate engineer".split(" "));
export const keywords = (text: string) => [...new Set((text.toLowerCase().match(/[a-z0-9+#]+/g) ?? []).filter(t => t.length > 2 && !STOP.has(t)))];
export function allEvidence(payload: InterviewPreparationPayload): SelectedEvidence[] {
  const c = payload.candidate, jobTerms = new Set(keywords(payload.targetJob.jobTitle + " " + payload.targetJob.descriptionText));
  const item = (sourceId: string, sourceType: SelectedEvidence["sourceType"], title: string, data: unknown, imageIds: string[] = []): SelectedEvidence => {
    const description = typeof data === "string" ? data : JSON.stringify(data);
    const matches = keywords(title + " " + description).filter(t => jobTerms.has(t)).length;
    // Shared distinct terms plus a small evidence-richness bonus only for matched records.
    return {sourceId, sourceType, title, description, relevanceScore: matches ? matches * 10 + (sourceType === "project" || sourceType === "experience" ? 5 : 0) : 0, imageIds};
  };
  return [
    item(c.cvProfileId, "profile", c.profile.fullName, {fullName:c.profile.fullName,headline:c.profile.headline,professionalSummary:c.profile.professionalSummary}),
    ...c.skills.items.map(x=>item(x.id,"skill",x.name,x)),
    ...c.workExperience.items.map(x=>item(x.id,"experience",x.jobTitle + " at " + x.employer,x)),
    ...c.projects.items.map(({images,...x})=>item(x.id,"project",x.name,x,images.map(i=>i.imageId))),
    ...c.education.items.map(x=>item(x.id,"education",x.qualification,x)),
    ...c.achievements.items.map(x=>item(x.id,"achievement",x.title,x)),
  ];
}
export function selectRelevantEvidence(payload: InterviewPreparationPayload, limit = 12): SelectedEvidence[] {
  if (payload.contractVersion !== "2.0" || !payload.readiness.isReady || payload.readiness.status !== "READY") throw new Error("CV and job must be confirmed before AI processing.");
  const all = allEvidence(payload);
  const profile = all[0];
  const remaining = all.slice(1).sort((a,b)=>b.relevanceScore-a.relevanceScore);
  return [profile,...remaining].slice(0,Math.max(0,limit));
}
export function selectionReport(payload: InterviewPreparationPayload, limit=12) {
  const selected = selectRelevantEvidence(payload,limit), chosen = new Set(selected.map(x=>x.sourceId));
  const text = allEvidence(payload).filter(x=>x.sourceType!=="profile").map(x=>x.title+" "+x.description).join(" ").toLowerCase();
  return {method:"Distinct keyword overlap, not semantic ranking", selected,
    omitted:allEvidence(payload).filter(x=>!chosen.has(x.sourceId)),
    zeroMatch: selected.filter(x=>x.sourceType!=="profile").every(x=>x.relevanceScore===0),
    jobTermsWithoutLexicalEvidence:keywords(payload.targetJob.descriptionText).filter(t=>!keywords(text).includes(t)),
    warning:"Zero-score sources are fallback background, not evidence of fit. Missing words are lexical gaps, not a complete assessment of qualifications."};
}
