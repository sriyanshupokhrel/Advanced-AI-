import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInterviewPreparationPayload, computeSectionFingerprints } from "../../src/lib/integration/interview-payload";
import { REVIEW_SECTIONS } from "../../src/lib/validation/job-schema";
import { selectRelevantEvidence } from "../../src/lib/ai/content-selector";
import { checkEvidence } from "../../src/lib/ai/evidence-checker";
import { decodeImage } from "../../src/lib/storage/image-decode";
import { inspectImage } from "../../src/lib/storage/image-inspection";
import { sampleCv, sampleJob } from "./sample-data";

function input(title = "Graduate Data Analyst", description = "Python SQL pandas data analysis and visualisation required for this graduate position.") {
  const cv = sampleCv({ fullName: "Alex Chan", headline: "Graduate Data Analyst", summary: "IT graduate seeking a data analyst role.", experience: [], achievements: [],
    skills: ["Python", "SQL", "pandas", "Streamlit"].map((name, i) => ({ id: `s${i}`, name, category: "" })),
    education: [{ id: "ed1", institution: "University of Technology Sydney", degree: "Bachelor of Information Technology", fieldOfStudy: "", startDate: "2023-02", endDate: "2025-11", grade: "", description: "" }],
    projects: [{ id: "p1", name: "Sales Analysis Dashboard", role: "Student Developer", url: "", technologies: "Python SQL pandas Streamlit", description: "Built an academic sales analysis dashboard using a sample retail dataset. Used SQL to query sales records and pandas to clean and summarise the data. Created a Streamlit dashboard showing monthly sales trends and sales by product category." }] });
  const job = sampleJob({ title, description });
  const fp = computeSectionFingerprints(cv, job);
  return buildInterviewPreparationPayload({ targetId: "t1", cv, job, confirmations: REVIEW_SECTIONS.map(section => ({ section, confirmedHash: fp[section], confirmedAt: new Date() })) });
}

test("AI selection rejects unconfirmed input", () => {
  const p = input(); p.readiness.isReady = false;
  assert.throws(() => selectRelevantEvidence(p), /confirmed/);
});
test("Alex A/B: keyword scores change; zero-score cloud evidence is explicit fallback with profile", () => {
  const a = selectRelevantEvidence(input());
  const b = selectRelevantEvidence(input("Cloud Engineer", "AWS cloud deployment infrastructure management responsibilities"));
  assert.ok((a.find(x => x.title === "SQL")?.relevanceScore??0)>0);
  assert.ok(b.every(x => x.relevanceScore === 0));
  assert.equal(b.length, 7);
  assert.equal(b[0].sourceType,"profile");
  assert.ok(b.find(x=>x.sourceType==="project")?.description.includes("Student Developer"));
  assert.ok(!b.some(x => /AWS/.test(x.title)));
});
test("profile-only and large evidence collections respect selection limit", () => {
  const p = input(); p.candidate.skills.items = []; p.candidate.projects.items = []; p.candidate.education.items = [];
  assert.equal(selectRelevantEvidence(p).length,1);
  assert.equal(selectRelevantEvidence(p)[0].sourceType,"profile");
  p.candidate.skills.items = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, name: "SQL", category: null }));
  assert.equal(selectRelevantEvidence(p, 12).length, 12);
  assert.equal(selectRelevantEvidence(p, 0).length, 0);
});
test("existing excerpt does not establish semantic support (known limitation)", () => {
  const result = checkEvidence(input(), [{ text: "I deployed AWS infrastructure and improved revenue by 90%", sourceType: "skill", sourceId: "s1", supportingText: "SQL" }]);
  assert.equal(result[0].status, "EXCERPT_FOUND_REVIEW_REQUIRED");
  assert.match(result[0].explanation, /semantic verification/);
});
test("unknown source and mismatched excerpt require review", () => {
  const result = checkEvidence(input(), [
    { text: "AWS", sourceType: "skill", sourceId: "missing", supportingText: "AWS" },
    { text: "AWS", sourceType: "skill", sourceId: "s1", supportingText: "AWS" },
  ]);
  assert.ok(result.every(x => x.status === "NEEDS_REVIEW"));
});
test("header inspection is deliberately only preflight; full decode rejects missing pixels", async () => {
  const bytes = new Uint8Array(33);
  bytes.set([137,80,78,71,13,10,26,10]);
  bytes.set([73,72,68,82], 12); bytes[19]=1; bytes[23]=1;
  assert.equal(inspectImage(bytes).ok, true);
  assert.equal((await decodeImage(bytes)).ok,false);
});
