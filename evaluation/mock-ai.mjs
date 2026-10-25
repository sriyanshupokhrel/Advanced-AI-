// Offline mock regression suite. Test fixtures are not production fallbacks or live evidence.
import {register} from "node:module";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
register("../tests/support/alias-hooks.mjs",import.meta.url);
register("./mock-hooks.mjs",import.meta.url);
const {generateInterviewPresentation}=await import("../src/lib/ai/interview-generator.ts");
const {analyseProjectImage}=await import("../src/lib/ai/image-analysis.ts");
const {validateClaimReview}=await import("../src/lib/ai/claim-review.ts");
const {validatePresentation,reviewUnits}=await import("../src/lib/ai/presentation-schema.ts");
const {providerError,modelJson,newBudget}=await import("../src/lib/ai/provider.ts");
const {z}=await import("zod");
const {buildInterviewPreparationPayload,computeSectionFingerprints}=await import("../src/lib/integration/interview-payload.ts");
const {sampleCv,sampleJob,sampleImage}=await import("../tests/unit/sample-data.ts");
const {testDeck,testReview}=await import("../tests/support/deck-fixture.mjs");
const cv=sampleCv(),job=sampleJob(),fp=computeSectionFingerprints(cv,job);
const p=buildInterviewPreparationPayload({targetId:"t1",cv,job,confirmations:Object.entries(fp).map(([section,confirmedHash])=>({section,confirmedHash,confirmedAt:new Date()}))});
const deck=()=>testDeck(p),review=d=>testReview(p,d);
globalThis.__requests=[];globalThis.__responses=[];
let failures=0;
async function check(name,fn){try{await fn();console.log("PASS MOCK "+name);}catch(e){failures++;console.log("FAIL MOCK "+name+": "+e.message);}}
delete process.env.GEMINI_API_KEY;
await check("missing key has typed 503",async()=>{await assert.rejects(generateInterviewPresentation(p),e=>e.code==="MISSING_KEY"&&e.status===503);assert.equal(globalThis.__requests.length,0);});
process.env.GEMINI_API_KEY="mock-only";
for(const [name,value] of [["empty",""],["invalid JSON","{oops"],["wrong schema",{}],["blank heading",{...deck(),slides:deck().slides.map(s=>({...s,heading:"   "}))}],["empty notes",{...deck(),slides:deck().slides.map(s=>({...s,speakerNotes:" "}))}],["blank bullet",{...deck(),slides:deck().slides.map(s=>({...s,bullets:[" "]}))}],["three slides",{...deck(),slides:deck().slides.slice(0,3)}]]){
 await check(name+" rejected",async()=>{globalThis.__responses=[value];await assert.rejects(generateInterviewPresentation(p));});
}
for(const [name,mutate] of [
 ["missing finding",r=>r.findings.pop()],
 ["duplicate finding",r=>r.findings[1]=structuredClone(r.findings[0])],
 ["unknown unit",r=>r.findings[0].unitId="unknown"],
 ["out of range slide",r=>r.findings[1].slideIndex=999],
 ["incorrect text",r=>r.findings[0].claim="AWS expert"],
 ["wrong source ID",r=>r.findings[0].sourceIds=["foreign-id"]],
 ["wrong excerpt",r=>r.findings[0].evidence[0].quote="invented AWS quote"],
 ["candidate uses job source",r=>{r.findings[0].sourceIds=["job:"+job.id];}],
 ]){
 await check(name+" blocked",()=>{const d=deck(),r=review(d);mutate(r);assert.throws(()=>validateClaimReview(p,d,r));});
}
await check("supported model verdict never equals automatic approval",async()=>{
 const d=deck();globalThis.__responses=[d,review(d)];const result=await generateInterviewPresentation(p);
 assert.equal(result.review.approved,false);assert.equal(result.review.status,"HUMAN_REVIEW_REQUIRED");assert.equal(result.review.coverageComplete,true);
});
await check("unsupported claim with real ID stays NEEDS_CHANGES",async()=>{
 const d=deck();d.slides[1].bullets=["I deployed AWS and improved revenue by 90%"];
 const r=review(d);r.findings.find(f=>f.unitId==="slide.1.bullet.0").supported=false;
 globalThis.__responses=[d,r];const result=await generateInterviewPresentation(p);assert.equal(result.review.status,"NEEDS_CHANGES");assert.equal(result.review.approved,false);
});
await check("lying supported verdict with real IDs remains human review",()=>{
 const d=deck();d.slides[1].bullets=["I deployed AWS and improved revenue by 90%"];
 assert.equal(validateClaimReview(p,d,review(d)).approved,false);
});
await check("single supported finding cannot approve omitted heading and notes",async()=>{
 const d=deck();d.slides[3].heading="AWS expert";d.slides[3].speakerNotes="I increased revenue by 90%";
 globalThis.__responses=[d,{findings:[{...review(d).findings[0],slideIndex:999}]}];const result=await generateInterviewPresentation(p);assert.equal(result.review.status,"INCOMPLETE_REVIEW");assert.equal(result.review.approved,false);assert.equal(result.review.coverageComplete,false);
});
await check("title and all fields have stable unique review IDs",()=>{
 const d=deck(),u=reviewUnits(d);assert.equal(u.length,13);assert.equal(new Set(u.map(x=>x.unitId)).size,u.length);assert.equal(u[0].unitId,"title");
});
await check("missing duplicate unknown reference entries rejected",()=>{
 for(const mutation of [d=>d.references.pop(),d=>d.references[1]=d.references[0],d=>d.references[0].unitId="unknown"]){const d=deck();mutation(d);assert.throws(()=>validatePresentation(p,d));}
});
await check("profile citation and linked source required",()=>{
 const d=deck();d.references.filter(r=>r.sourceIds.includes(cv.id)).forEach(r=>r.sourceIds.splice(0,1,"ed1"));d.slides[0].sourceIds=["ed1"];assert.throws(()=>validatePresentation(p,d));
});
await check("known-but-foreign image/project association rejected",()=>{
 const d=deck();d.slides[2].imageIds=["img1"];assert.throws(()=>validatePresentation(p,d,[{imageId:"img1",projectId:"foreign",relevance:"relevant"}]));
});
await check("missing closing role rejected",()=>{const d=deck();d.slides[3].role="evidence";assert.throws(()=>validatePresentation(p,d));});
await check("valid five-slide deck accepted",()=>{
 const d=deck();d.slides.splice(2,0,structuredClone(d.slides[1]));d.references=reviewUnits(d).map(u=>({unitId:u.unitId,sourceIds:u.unitId==="title"?[cv.id]:u.unitId.endsWith("heading")?[]:d.slides[u.slideIndex].sourceIds}));assert.equal(validatePresentation(p,d).slides.length,5);
});
const bytes=readFileSync("tests/fixtures/diagram-640x480.png");
const image={...sampleImage(),imageId:"trusted-id",confirmation:{isConfirmed:true},fileAvailable:true,description:{altText:"User: TEST ONLY gradient",caption:"not a dashboard",source:"USER_PROVIDED"}};
const input={image,imageBytes:bytes,projectId:"pr1",projectName:"Trusted project",projectDescription:"A budgeting app",jobDescription:"Data analyst"};
const analysis={visibleFeatures:["Abstract colour gradient"],relevance:"irrelevant",relevanceReason:"No interface or chart",limitations:["Does not prove authorship"]};
await check("model extra fields cannot overwrite trusted identities or caption",async()=>{
 globalThis.__responses=[{...analysis,imageId:"invented",projectId:"foreign",projectName:"invented",presentationCaption:"Dashboard preview",relevantSkills:["AWS"]}];
 const r=await analyseProjectImage(input);assert.equal(r.imageId,"trusted-id");assert.equal(r.projectId,"pr1");assert.equal(r.projectName,"Trusted project");assert.equal(r.presentationCaption,"Abstract colour gradient");assert.equal(r.relevance,"irrelevant");
});
await check("actual decodable image bytes and user description sent",async()=>{
 globalThis.__responses=[analysis];await analyseProjectImage(input);const req=globalThis.__requests.at(-1);assert.equal(req.contents[0].parts[1].inlineData.data,bytes.toString("base64"));assert.match(req.contents[0].parts[0].text,/TEST ONLY gradient/);assert.equal(req.config.httpOptions.retryOptions.attempts,1);
});
await check("related image remains usable with correct project",()=>{
 const img=sampleImage(),cv2=sampleCv({images:[img]}),fp2=computeSectionFingerprints(cv2,job);
 const p2=buildInterviewPreparationPayload({targetId:"t1",cv:cv2,job,confirmations:Object.entries(fp2).map(([section,confirmedHash])=>({section,confirmedHash,confirmedAt:new Date()}))});
 const a={...analysis,relevance:"relevant",imageId:"img1",projectId:"pr1",projectName:"Budget Buddy",presentationCaption:"Chart"};assert.equal(validatePresentation(p2,testDeck(p2,[a]),[a]).slides[2].imageIds[0],"img1");
 a.relevance="irrelevant";const d=testDeck(p2);d.slides[2].imageIds=["img1"];assert.throws(()=>validatePresentation(p2,d,[a]));
});
await check("corrupt bytes rejected before provider",async()=>{const before=globalThis.__requests.length;await assert.rejects(analyseProjectImage({...input,imageBytes:new Uint8Array([1,2,3])}));assert.equal(globalThis.__requests.length,before);});
for(const [status,name,message,code] of [[429,"Error","rate limited","RATE_LIMIT"],[503,"Error","provider down","AI_UNAVAILABLE"],[0,"TimeoutError","timed out","AI_TIMEOUT"]]){
 await check("provider classification "+code,async()=>{const e=Object.assign(new Error(message),{status,name});globalThis.__responses=[e];await assert.rejects(modelJson({contents:"test"},z.object({})),x=>x.code===code);assert.equal(providerError(e).code,code);});
}
await check("SDK status-text rate limit remains distinguishable",()=>assert.equal(providerError(new Error("Non-retryable exception Too Many Requests sending request")).code,"RATE_LIMIT"));
await check("budget and overall deadline prevent transport",async()=>{
 for(const b of [{...newBudget(),maxCalls:0},{...newBudget(),deadline:Date.now()-1}]){const n=globalThis.__requests.length;await assert.rejects(modelJson({contents:"test"},z.object({}),b),e=>e.code==="AI_BUDGET");assert.equal(globalThis.__requests.length,n);}
});
delete process.env.GEMINI_API_KEY;
process.exitCode=failures?1:0;
