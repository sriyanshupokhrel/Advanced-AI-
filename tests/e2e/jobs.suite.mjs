// Job descriptions, CV–job pairings, the integration payload and confirmation.
// "full" leaves one confirmed pairing behind; "verify" checks it after a restart.
import { base, call, check, finish, json, kept, phase } from "./lib.mjs";

// Pasted text with features that must survive untouched.
const VERBATIM = "  \n\tGraduate Data Analyst – Café Analytics 😀\r\n\nResponsibilities:\n  • Build dashboards in SQL & Python\n  • Present <insights> to \"stakeholders\"\n\nRequirements:\n- 0–2 years' experience\n   \n";

const validCv = {
  fullName: "Test Candidate", headline: "", email: "test.candidate@example.com", phone: "", location: "Sydney",
  website: "", summary: "Test summary.",
  education: [{ institution: "Example University", degree: "BSc", fieldOfStudy: "", startDate: "2021-02", endDate: "2024-11", grade: "", description: "" }],
  experience: [], skills: [{ name: "SQL", category: "Data" }], projects: [], achievements: [],
};
const validJob = { title: "  Graduate Data Analyst ", companyName: "Example Analytics", companyInfo: "", jobReference: "REQ-1", description: VERBATIM };

if (phase === "verify") {
  const { targetId, jobId, cvId } = kept;
  let r = await call(`/api/jobs/${jobId}`);
  check("job persisted after restart, text byte-identical", r.status === 200 && r.body.description === VERBATIM);
  r = await call(`/api/targets/${targetId}/context`);
  check("pairing + confirmation persisted after restart", r.status === 200 && r.body.readiness.isReady === true && r.body.candidate.cvProfileId === cvId);
  r = await call(`/prepare/${targetId}`);
  check("review page renders after restart", r.status === 200 && r.body.includes("Test Candidate") && r.body.includes("Ready"));
  finish();
} else {

console.log("── Job description validation");
let r = await call("/api/jobs", json("POST", { ...validJob, description: "" }));
check("empty description → 400", r.status === 400 && r.body.fieldErrors.description === "Paste the job description.");
r = await call("/api/jobs", json("POST", { ...validJob, description: " ".repeat(300) + "\n\n" }));
check("whitespace-only description → 400", r.status === 400 && r.body.fieldErrors.description === "Paste the job description.");
r = await call("/api/jobs", json("POST", { ...validJob, description: "Analyst role, apply now." }));
check("too-short description → 400", r.status === 400 && /too short/.test(r.body.fieldErrors.description), r.body.fieldErrors?.description);
r = await call("/api/jobs", json("POST", { ...validJob, description: "x".repeat(30001) }));
check("over-long description → 400", r.status === 400 && /30,000/.test(r.body.fieldErrors.description));
r = await call("/api/jobs", json("POST", { ...validJob, title: "t".repeat(151) }));
check("over-long title → 400", r.status === 400 && Boolean(r.body.fieldErrors.title));
r = await call("/api/jobs", json("POST", { title: "No description" }));
check("missing description field → 400", r.status === 400 && Boolean(r.body.fieldErrors.description));
r = await call("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" });
check("malformed JSON → 400", r.status === 400);

console.log("── Job description create / read / update");
r = await call("/api/jobs", json("POST", validJob));
const job = r.body;
check("create → 201", r.status === 201, job.id);
check("description stored byte-for-byte (spaces, tabs, CRLF, emoji, <, quotes)", job.description === VERBATIM);
check("short fields trimmed, blanks are \"\"", job.title === "Graduate Data Analyst" && job.companyInfo === "");
r = await call(`/api/jobs/${job.id}`);
check("GET returns identical text", r.status === 200 && r.body.description === VERBATIM);
r = await call("/api/jobs", json("POST", { title: "", companyName: "", companyInfo: "", jobReference: "", description: "A job description with no title or company but long enough text." }));
check("only description required (optional fields blank) → 201", r.status === 201);
const minimalJob = r.body;
r = await call("/api/jobs");
check("list includes jobs with excerpt", r.status === 200 && r.body.some((j) => j.id === job.id && j.excerpt.startsWith("Graduate Data Analyst")));
r = await call(`/api/jobs/${minimalJob.id}`, json("PUT", { ...validJob, title: "Edited title", description: "Edited description that is definitely longer than fifty characters." }));
check("PUT updates job", r.status === 200 && r.body.title === "Edited title" && r.body.updatedAt !== minimalJob.updatedAt);
r = await call(`/api/jobs/${minimalJob.id}`, json("PUT", { ...validJob, description: "short" }));
check("PUT with invalid data → 400", r.status === 400);
r = await call("/api/jobs/missing-id", json("PUT", validJob));
check("PUT unknown job → 404", r.status === 404);
r = await call("/api/jobs/missing-id");
check("GET unknown job → 404", r.status === 404);

console.log("── Pairing a CV with a job");
r = await call("/api/cvs", json("POST", validCv));
const cv = r.body;
check("test CV created", r.status === 201);
r = await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: job.id }));
const target = r.body;
check("pair CV + job → 201, NOT_CONFIRMED", r.status === 201 && target.confirmationStatus === "NOT_CONFIRMED" && target.cv.id === cv.id && target.job.id === job.id);
r = await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: job.id }));
check("pairing again is idempotent → 200, same id", r.status === 200 && r.body.id === target.id);
r = await call("/api/targets", json("POST", { cvProfileId: "missing", jobDescriptionId: job.id }));
check("unknown CV → 404 with field error", r.status === 404 && Boolean(r.body.fieldErrors.cvProfileId));
r = await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: "missing" }));
check("unknown job → 404 with field error", r.status === 404 && Boolean(r.body.fieldErrors.jobDescriptionId));
r = await call("/api/targets", json("POST", {}));
check("nothing selected → 400 with both field errors", r.status === 400 && Boolean(r.body.fieldErrors.cvProfileId && r.body.fieldErrors.jobDescriptionId));
r = await call(`/api/jobs/${job.id}`);
check("job reports targetCount 1", r.body.targetCount === 1);

console.log("── Integration payload (v2.0)");
r = await call(`/api/targets/${target.id}/context`);
let ctx = r.body;
check("payload → 200, version 2.0", r.status === 200 && ctx.contractVersion === "2.0" && ctx.targetId === target.id);
check("candidate identity + details", ctx.candidate.cvProfileId === cv.id && ctx.candidate.profile.fullName === "Test Candidate" && ctx.candidate.profile.professionalSummary === "Test summary.");
check("missing optional values are null", ctx.candidate.profile.headline === null && ctx.candidate.profile.contact.phone === null && ctx.candidate.education.items[0].grade === null);
check("all sections present", ["education", "workExperience", "skills", "projects", "achievements"].every((k) => Array.isArray(ctx.candidate[k].items)) && Array.isArray(ctx.candidate.otherImages) && ctx.candidate.education.items[0].qualification === "BSc");
check("target job fields", ctx.targetJob.jobTitle === "Graduate Data Analyst" && ctx.targetJob.company.name === "Example Analytics" && ctx.targetJob.company.information === null && ctx.targetJob.jobReference === "REQ-1");
check("complete job text verbatim in payload", ctx.targetJob.descriptionText === VERBATIM);
check("nothing confirmed yet, not ready", ctx.readiness.isReady === false && ctx.readiness.sections.confirmed === 0 && ctx.targetJob.confirmation.status === "NOT_CONFIRMED");
const codes = [...new Set(ctx.readiness.issues.filter((i) => i.severity === "WARNING").map((n) => n.code))].sort().join(",");
check("warnings for missing information", codes === "EMPTY_SECTION", codes);
r = await call("/api/targets/missing/context");
check("payload for unknown pairing → 404", r.status === 404);

console.log("── Confirmation and data consistency");
r = await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: "yes" }));
check("invalid confirmation body → 400", r.status === 400);
r = await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: true }));
check("confirm all sections → CONFIRMED (no images yet)", r.status === 200 && r.body.confirmationStatus === "CONFIRMED" && r.body.readiness.isReady);
r = await call(`/api/targets/${target.id}/context`);
check("payload READY", r.body.readiness.status === "READY" && r.body.readiness.isReady === true);

const savedCv = (await call(`/api/cvs/${cv.id}`)).body;
const { id: _i, createdAt: _c, updatedAt: _u, images: _im, ...cvInput } = savedCv;
r = await call(`/api/cvs/${cv.id}`, json("PUT", cvInput));
r = await call(`/api/targets/${target.id}`);
check("re-saving CV with no changes keeps CONFIRMED", r.body.confirmationStatus === "CONFIRMED");

await call(`/api/cvs/${cv.id}`, json("PUT", { ...cvInput, summary: "Changed summary." }));
r = await call(`/api/targets/${target.id}/context`);
check("editing CV summary → PROFILE CHANGED_SINCE_CONFIRMATION, not ready", r.body.candidate.profile.confirmation.status === "CHANGED_SINCE_CONFIRMATION" && r.body.readiness.isReady === false);
check("other sections stay CONFIRMED", r.body.candidate.education.confirmation.status === "CONFIRMED" && r.body.targetJob.confirmation.status === "CONFIRMED");
check("payload shows the latest CV data", r.body.candidate.profile.professionalSummary === "Changed summary.");

await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: true }));
await call(`/api/jobs/${job.id}`, json("PUT", { ...validJob, companyInfo: "Mid-size consultancy." }));
r = await call(`/api/targets/${target.id}`);
check("editing job → CHANGED_SINCE_CONFIRMATION", r.body.confirmationStatus === "CHANGED_SINCE_CONFIRMATION" && r.body.sections.TARGET_JOB.status === "CHANGED_SINCE_CONFIRMATION");

await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: true }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "photo.png");
for (const [k, v] of Object.entries({ kind: "PROFILE_PHOTO", altText: "Headshot", caption: "", projectId: "" })) form.append(k, v);
await fetch(`${base}/api/cvs/${cv.id}/images`, { method: "POST", body: form });
r = await call(`/api/targets/${target.id}/context`);
check("adding an unconfirmed image → not ready, image in payload", r.body.readiness.isReady === false && r.body.candidate.otherImages.length === 1 && r.body.candidate.otherImages[0].description.altText === "Headshot" && r.body.readiness.issues.some((i) => i.code === "IMAGE_NOT_CONFIRMED"));
await call(`/api/cvs/${cv.id}/images/${r.body.candidate.otherImages[0].imageId}`, json("PATCH", { confirmed: true }));

r = await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: false }));
check("withdraw → NOT_CONFIRMED", r.body.confirmationStatus === "NOT_CONFIRMED" && r.body.sections.PROFILE.confirmedAt === null);
r = await call(`/api/targets/${target.id}`, json("PATCH", { confirmed: true }));
check("re-confirm (sections + image confirmed) → CONFIRMED", r.body.confirmationStatus === "CONFIRMED");

console.log("── Listing, filtering, deletion cascades");
const tmpCv = (await call("/api/cvs", json("POST", { ...validCv, fullName: "Temp CV" }))).body;
const pairA = (await call("/api/targets", json("POST", { cvProfileId: tmpCv.id, jobDescriptionId: job.id }))).body;
const pairB = (await call("/api/targets", json("POST", { cvProfileId: tmpCv.id, jobDescriptionId: minimalJob.id }))).body;
r = await call(`/api/targets?cvId=${tmpCv.id}`);
check("filter by cvId", r.body.length === 2 && r.body.every((t) => t.cv.id === tmpCv.id));
r = await call(`/api/targets?jobId=${job.id}`);
check("filter by jobId", r.body.length === 2 && r.body.every((t) => t.job.id === job.id));

r = await call(`/api/jobs/${minimalJob.id}`, { method: "DELETE" });
check("delete job → 204", r.status === 204);
r = await call(`/api/targets/${pairB.id}`);
check("its pairing is removed (cascade)", r.status === 404);
r = await call(`/api/cvs/${tmpCv.id}`);
check("the CV is kept", r.status === 200);

r = await call(`/api/cvs/${tmpCv.id}`, { method: "DELETE" });
r = await call(`/api/targets/${pairA.id}`);
check("delete CV → its pairing is removed (cascade)", r.status === 404);
r = await call(`/api/jobs/${job.id}`);
check("the job is kept, targetCount back to 1", r.status === 200 && r.body.targetCount === 1);

const tmpPair = (await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: (await call("/api/jobs", json("POST", { ...validJob, title: "Temp job" }))).body.id }))).body;
r = await call(`/api/targets/${tmpPair.id}`, { method: "DELETE" });
check("delete pairing → 204", r.status === 204);
check("…then 404, CV and job kept", (await call(`/api/targets/${tmpPair.id}`)).status === 404 && (await call(`/api/cvs/${cv.id}`)).status === 200 && (await call(`/api/jobs/${tmpPair.job.id}`)).status === 200);
await call(`/api/jobs/${tmpPair.job.id}`, { method: "DELETE" });

console.log("── Pages");
for (const [path, expect] of [
  ["/jobs", "Graduate Data Analyst"],
  ["/jobs/new", "Add a job description"],
  [`/jobs/${job.id}`, "Edit job description"],
  ["/prepare", "Test Candidate"],
  [`/prepare?cvId=${cv.id}&jobId=deleted-job`, "no longer exists"],
  [`/prepare/${target.id}`, "Job description (as pasted)"],
  ["/", "Pair with a job"],
]) {
  r = await call(path);
  check(`page ${path}`, r.status === 200 && r.body.includes(expect), `expects "${expect}"`);
}

finish({ targetId: target.id, jobId: job.id, cvId: cv.id });
}
