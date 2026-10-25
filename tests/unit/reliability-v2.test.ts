import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {decodeImage} from "@/lib/storage/image-decode";
import {MAX_IMAGE_BYTES} from "@/lib/validation/image-schema";
import {selectionReport,selectRelevantEvidence} from "@/lib/ai/content-selector";
import {snapshotToken} from "@/lib/ai/snapshot";
import {buildInterviewPreparationPayload,computeSectionFingerprints} from "@/lib/integration/interview-payload";
import {sampleCv,sampleJob} from "./sample-data";
function payload(){const cv=sampleCv(),job=sampleJob(),fp=computeSectionFingerprints(cv,job);return buildInterviewPreparationPayload({targetId:"t",cv,job,confirmations:Object.entries(fp).map(([section,confirmedHash])=>({section,confirmedHash,confirmedAt:new Date()}))});}
test("full decode accepts PNG/JPEG and genuine GIF/WebP, ignores filename",async()=>{
 for(const name of ["diagram-640x480.png","photo-280x175.jpg","photo-1920x1200.jpg"])assert.ok((await decodeImage(readFileSync(new URL("../fixtures/"+name,import.meta.url)))).ok,name);
 for(const encoded of ["R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"])assert.ok((await decodeImage(Buffer.from(encoded,"base64"))).ok);
});
test("decode rejects oversized bytes, corrupt pixel body and SVG",async()=>{
 assert.equal((await decodeImage(new Uint8Array(MAX_IMAGE_BYTES+1))).ok,false);
 assert.equal((await decodeImage(new TextEncoder().encode("<svg/>"))).ok,false);
 const b=readFileSync(new URL("../fixtures/diagram-640x480.png",import.meta.url));assert.equal((await decodeImage(b.subarray(0,33))).ok,false);
});
test("selection retains profile achievements and detailed project role and technologies",()=>{
 const p=payload(),selected=selectRelevantEvidence(p,30);assert.ok(selected.some(x=>x.sourceId===p.candidate.cvProfileId&&x.sourceType==="profile"));assert.ok(selected.some(x=>x.sourceType==="achievement"));assert.ok(selected.find(x=>x.sourceType==="project")?.description.includes("Next.js"));
});
test("zero lexical match is explicitly reported as fallback and gaps",()=>{
 const p=payload();p.targetJob.jobTitle="Zyx";p.targetJob.descriptionText="AWS Kubernetes Terraform";const r=selectionReport(p);assert.equal(r.zeroMatch,true);assert.ok(r.jobTermsWithoutLexicalEvidence.includes("aws"));assert.match(r.method,/not semantic/);
});
test("snapshot ignores payload generation timestamp and changes with source or readiness",()=>{
 const p=payload(),token=snapshotToken(p);p.generatedAt="different";assert.equal(snapshotToken(p),token);p.fingerprints.PROFILE="new";assert.notEqual(snapshotToken(p),token);
});

test("provider grammar keeps slide bounds while local schema retains all limits",async()=>{
 const {providerSchema}=await import("@/lib/ai/provider");
 const value=providerSchema({properties:{slides:{type:"array",minItems:4,maxItems:5,items:{type:"string",maxLength:3}}}}) as {properties:{slides:{minItems:number;maxItems:number;items:{maxLength?:number}}}};
 assert.equal(value.properties.slides.minItems,4);assert.equal(value.properties.slides.maxItems,5);assert.equal(value.properties.slides.items.maxLength,undefined);
});
