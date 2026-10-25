// The complete review-and-confirm workflow, end to end:
// create CV → add job → upload project images → pair → review → confirm → payload,
// plus missing fields, edits after confirmation, invalid associations, missing
// images, invalid stored data, API errors and deletion consistency.
// Set E2E_EXAMPLE_OUT to also write the READY payload to a file (used to
// regenerate docs/integration-payload.example.json from the real API).
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { confirmReviewedImage, confirmReviewedSections, generateFromReviewedContext, base, call, check, finish, fixture, json, kept, phase, testDb, uploadDir } from "./lib.mjs";

const codes = (payload, severity) => payload.readiness.issues.filter((i) => !severity || i.severity === severity).map((i) => i.code);
const confirm = (targetId, body) => confirmReviewedSections(targetId, body);
const payloadOf = async (targetId) => (await call(`/api/targets/${targetId}/context`)).body;
const downloadPptx = async (targetId, presentationId, expectedRevision) => {
  const response = await fetch(`${base}/api/targets/${targetId}/presentations/${presentationId}/export`, json("POST", { expectedRevision, humanReviewed: true }));
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("presentationml.presentation")) {
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text }; }
    return { status: response.status, body, headers: response.headers, bytes: null };
  }
  return { status: response.status, body: null, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
};

const inspectPptx = async (bytes) => {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files);
  const slides = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  const notes = names.filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)).sort();
  const media = names.filter((name) => /^ppt\/media\//.test(name));
  return {
    slides,
    notes,
    media,
    slideXml: (await Promise.all(slides.map((name) => zip.file(name).async("string")))).join("\n"),
    notesXml: (await Promise.all(notes.map((name) => zip.file(name).async("string")))).join("\n"),
  };
};

if (phase === "verify") {
  const { targetId, presentationId } = kept;
  const p = await payloadOf(targetId);
  check("after restart: payload still READY with all confirmations", p.readiness.isReady && p.readiness.sections.confirmed === 7 && p.readiness.images.confirmed === p.readiness.images.total);
  const r = await call(`/api/targets/${targetId}/context?requireReady=true`);
  check("after restart: requireReady → 200", r.status === 200);
  const img = p.candidate.projects.items[0].images[0];
  check("after restart: project image file served", (await fetch(base + img.url)).status === 200);
  const savedPresentation = await call(`/api/targets/${targetId}/presentation`);
  check("after restart: saved presentation and incomplete draft persisted", savedPresentation.status === 200 && savedPresentation.body.id === presentationId && savedPresentation.body.draft.title === "Persisted after source change" && savedPresentation.body.draft.slides[0].heading === "");
  finish();
} else {
  // ── 1. Create and save a CV ─────────────────────────────────────────────
  console.log("── 1. Create CV → save");
  const cvInput = {
    fullName: "Alex Morgan",
    headline: "Graduate Software Engineer",
    email: "alex.morgan@example.com",
    phone: "+61 400 123 456",
    location: "Sydney, NSW",
    website: "https://github.com/example-alex",
    summary: "Final-year software engineering student with internship experience building data dashboards and a passion for accessible web applications.",
    education: [{ institution: "University of Technology Sydney", degree: "Bachelor of Engineering (Honours)", fieldOfStudy: "Software Engineering", startDate: "2022-02", endDate: "2025-11", grade: "Distinction average", description: "" }],
    experience: [
      { employer: "Harbour Data Co.", role: "Software Engineering Intern", location: "Sydney", startDate: "2024-11", endDate: "2025-02", isCurrent: false, description: "Built React dashboards for logistics KPIs.\nReduced report generation time by automating SQL exports." },
      { employer: "UTS Library", role: "Student Assistant", location: "Sydney", startDate: "2023-03", endDate: "", isCurrent: true, description: "Help students with digital resources." },
    ],
    skills: [
      { name: "TypeScript", category: "Languages" },
      { name: "Python", category: "Languages" },
      { name: "React", category: "Frameworks" },
      { name: "PostgreSQL", category: "Databases" },
    ],
    projects: [
      { name: "Budget Buddy", role: "Lead developer", url: "https://github.com/example-alex/budget-buddy", technologies: "Next.js, Prisma, Chart.js", description: "A personal finance app that categorises spending and visualises monthly budgets." },
      { name: "Campus Navigator", role: "Team member", url: "", technologies: "React Native", description: "An accessible indoor navigation app for the UTS campus." },
    ],
    achievements: [{ title: "Dean's Merit List", issuer: "UTS Faculty of Engineering and IT", date: "2024-12", description: "" }],
  };
  let r = await call("/api/cvs", json("POST", cvInput));
  const cv = r.body;
  check("CV created with all sections", r.status === 201 && cv.projects.length === 2 && cv.experience.length === 2);
  const [budget, campus] = cv.projects;

  // ── 2. Add target job ──────────────────────────────────────────────────
  console.log("── 2. Add target job");
  const jobText =
    "Graduate Software Engineer — Harbourline Analytics\n\nAbout the role\nJoin our product team building data visualisation tools used by logistics companies across Australia.\n\nYou will:\n• Build features in TypeScript and React\n• Work with PostgreSQL data models\n• Present your work in fortnightly demos\n\nAbout you\n- Degree in Software Engineering or similar (completed by early 2026)\n- Experience with a modern web framework\n- Clear communicator\n";
  r = await call("/api/jobs", json("POST", { title: "Graduate Software Engineer", companyName: "Harbourline Analytics", companyInfo: "Sydney-based analytics company, ~120 staff.", jobReference: "HLA-GRAD-2026", description: jobText }));
  const job = r.body;
  check("job saved", r.status === 201);

  // ── 3. Upload project images ──────────────────────────────────────────
  console.log("── 3. Upload project images");
  const upload = async (file, type, meta) => {
    const form = new FormData();
    form.append("file", new Blob([fixture(file)], { type }), file);
    for (const [k, v] of Object.entries({ caption: "", projectId: "", ...meta })) form.append(k, v);
    return call(`/api/cvs/${cv.id}/images`, { method: "POST", body: form });
  };
  const dashboard = (await upload("diagram-640x480.png", "image/png", { kind: "PROJECT_SCREENSHOT", altText: "Budget Buddy monthly spending dashboard", caption: "Monthly view with category breakdown", projectId: budget.id })).body;
  const mobile = (await upload("screen-300x200.png", "image/png", { kind: "PROJECT_SCREENSHOT", altText: "Campus Navigator route screen", projectId: campus.id })).body;
  const photo = (await upload("photo-280x175.jpg", "image/jpeg", { kind: "PROFILE_PHOTO", altText: "Headshot of Alex Morgan" })).body;
  check("3 images uploaded and linked", dashboard.projectId === budget.id && mobile.projectId === campus.id && photo.projectId === null);

  // ── 4. Pair + review ───────────────────────────────────────────────────
  console.log("── 4. Review information");
  r = await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: job.id }));
  const target = r.body;
  check("CV paired with job", r.status === 201 && target.readiness.isReady === false);
  let p = await payloadOf(target.id);
  check("payload v2.0, ACTION_REQUIRED, 0/7 sections, 0/3 images", p.contractVersion === "2.0" && p.readiness.status === "ACTION_REQUIRED" && p.readiness.sections.confirmed === 0 && p.readiness.images.total === 3 && p.readiness.images.confirmed === 0);
  check("7 SECTION_NOT_CONFIRMED + 3 IMAGE_NOT_CONFIRMED blocking issues", codes(p, "BLOCKING").filter((c) => c === "SECTION_NOT_CONFIRMED").length === 7 && codes(p, "BLOCKING").filter((c) => c === "IMAGE_NOT_CONFIRMED").length === 3);
  check("issues have understandable messages", p.readiness.issues.every((i) => i.message.length > 20) && p.readiness.issues.some((i) => i.message === 'Work experience has not been confirmed yet. Review it and click "Confirm".'));
  check("disclaimer states confirmation ≠ verification", /not been independently verified/.test(p.verificationDisclaimer));
  check("project images nested under the right project", p.candidate.projects.items[0].images[0].imageId === dashboard.id && p.candidate.projects.items[1].images[0].imageId === mobile.id && p.candidate.otherImages[0].imageId === photo.id);
  check("unconfirmed data is labelled as such", p.candidate.profile.confirmation.isConfirmed === false && p.candidate.projects.items[0].images[0].confirmation.status === "NOT_CONFIRMED");
  r = await call(`/prepare/${target.id}`);
  check("review page lists what needs attention", r.status === 200 && r.body.includes("items need your attention") && r.body.includes("Personal details &amp; summary") && r.body.includes("Budget Buddy monthly spending dashboard"));
  check("presentation entry is disabled until READY", r.body.includes('aria-disabled="true"') && r.body.includes("Interview presentation"));
  r = await call(`/prepare/${target.id}/presentation`);
  check("presentation page renders context loading state", r.status === 200 && r.body.includes("Loading confirmed CV, job and image context"));
  r = await call(`/api/targets/${target.id}/context?requireReady=true`);
  check("requireReady before confirmation → 409 with blocking issues", r.status === 409 && r.body.issues.length === 10 && r.body.issues.every((i) => i.severity === "BLOCKING"));

  // ── Request validation & API errors ───────────────────────────────────
  console.log("── API validation and errors");
  r = await confirm(target.id, { confirmed: true, sections: ["SALARY"] });
  check("unknown section → 400", r.status === 400 && /must be one of/.test(Object.values(r.body.fieldErrors)[0]));
  r = await confirm(target.id, { confirmed: true, sections: [] });
  check("empty sections list → 400", r.status === 400);
  r = await confirm(target.id, { confirmed: true, expectedFingerprints: { PROFILE: "abc" } });
  check("malformed fingerprint → 400", r.status === 400);
  r = await call(`/api/targets/${target.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{oops" });
  check("malformed JSON → 400", r.status === 400 && r.body.error === "Request body must be valid JSON.");
  r = await confirm("no-such-target", { confirmed: true });
  check("unknown pairing → 404 (PATCH)", r.status === 404 && r.body.error === "CV–job pairing not found.");
  check("unknown pairing → 404 (payload)", (await call("/api/targets/no-such-target/context")).status === 404);
  r = await confirm(target.id, { confirmed: true, sections: ["PROFILE"], expectedFingerprints: { PROFILE: "0".repeat(64) } });
  check("stale fingerprint → 409, nothing confirmed", r.status === 409 && /changed since this page was loaded/.test(r.body.error) && (await payloadOf(target.id)).readiness.sections.confirmed === 0);

  // ── 5. Confirm information ─────────────────────────────────────────────
  console.log("── 5. Confirm information");
  p = await payloadOf(target.id);
  r = await confirm(target.id, { confirmed: true, sections: ["PROFILE", "EDUCATION"], expectedFingerprints: { PROFILE: p.fingerprints.PROFILE, EDUCATION: p.fingerprints.EDUCATION } });
  check("confirm two sections with matching fingerprints", r.status === 200 && r.body.sections.PROFILE.status === "CONFIRMED" && r.body.sections.EDUCATION.status === "CONFIRMED" && r.body.sections.SKILLS.status === "NOT_CONFIRMED");
  r = await confirm(target.id, { confirmed: true, sections: ["EXPERIENCE", "SKILLS", "PROJECTS", "ACHIEVEMENTS", "TARGET_JOB"], expectedFingerprints: p.fingerprints });
  check("confirm remaining sections → 7/7, still not ready (images)", r.body.readiness.sections.confirmed === 7 && r.body.readiness.isReady === false);
  p = await payloadOf(target.id);
  check("only image issues remain", codes(p, "BLOCKING").every((c) => c === "IMAGE_NOT_CONFIRMED"));
  for (const img of [dashboard, mobile, photo]) await confirmReviewedImage(cv.id, img.id);

  // ── 6. Retrieve the payload ────────────────────────────────────────────
  console.log("── 6. Retrieve structured integration payload");
  r = await call(`/api/targets/${target.id}/context?requireReady=true`);
  p = r.body;
  check("requireReady → 200, READY", r.status === 200 && p.readiness.status === "READY" && p.readiness.isReady && p.readiness.readySince);
  check("no blocking issues; only non-blocking notes", codes(p, "BLOCKING").length === 0);
  check("stable ids match the stored records", p.candidate.cvProfileId === cv.id && p.targetJob.jobDescriptionId === job.id && p.candidate.workExperience.items[0].id === cv.experience[0].id && p.candidate.projects.items[0].id === budget.id);
  check("timestamps present", [p.generatedAt, p.candidate.createdAt, p.candidate.lastUpdatedAt, p.targetJob.createdAt, p.targetJob.lastUpdatedAt, p.candidate.profile.confirmation.confirmedAt, p.candidate.projects.items[0].images[0].uploadedAt].every((t) => !Number.isNaN(Date.parse(t))));
  check("job text verbatim", p.targetJob.descriptionText === jobText);
  check("current job: isCurrent true, endDate null", p.candidate.workExperience.items[1].isCurrent === true && p.candidate.workExperience.items[1].endDate === null);
  check("image metadata for multimodal use", p.candidate.projects.items[0].images[0].mimeType === "image/png" && p.candidate.projects.items[0].images[0].width === 640 && p.candidate.projects.items[0].images[0].description.source === "USER_PROVIDED");
  check("every confirmation is basis USER_REVIEW", [p.candidate.profile.confirmation, p.targetJob.confirmation, p.candidate.otherImages[0].confirmation].every((c) => c.basis === "USER_REVIEW" && c.isConfirmed));
  r = await call(`/prepare/${target.id}`);
  check("review page shows READY and presentation link", r.body.includes("Ready: everything has been reviewed and confirmed") && r.body.includes(`/prepare/${target.id}/presentation`));
  r = await call("/prepare");
  const listText = r.body.replace(/<!-- -->/g, ""); // React separates adjacent text nodes with comments
  check("pairing list shows Ready", listText.includes(">Ready<") && listText.includes("Sections 7/7"));
  if (process.env.E2E_EXAMPLE_OUT) {
    writeFileSync(process.env.E2E_EXAMPLE_OUT, JSON.stringify(p, null, 2) + "\n");
    console.log(`      (example payload written to ${process.env.E2E_EXAMPLE_OUT})`);
  }

  // ── Presentation persistence (mocked pipeline; no model call) ───────────
  console.log("── Presentation generation and persistence (mocked provider)");
  r = await call(`/api/targets/${target.id}/generate-interview`, { method: "POST" });
  check("generation without reviewed snapshot → 409", r.status === 409 && r.body.code === "STALE_SELECTION");
  r = await call(`/api/targets/${target.id}/generate-interview`, json("POST", { expectedSourceFingerprint: "stale" }));
  check("generation with stale reviewed snapshot → 409", r.status === 409 && r.body.code === "STALE_SELECTION");
  r = await generateFromReviewedContext(target.id);
  const firstPresentation = r.body;
  check("successful mocked generation is persisted", r.status === 200 && firstPresentation.presentationId && firstPresentation.revision === 1);
  r = await generateFromReviewedContext(target.id);
  const generated = r.body;
  check("regeneration creates a new independent record", r.status === 200 && generated.presentationId !== firstPresentation.presentationId);
  const presentationDb = testDb();
  check("both generated originals remain stored", await presentationDb.interviewPresentationRecord.count({ where: { targetId: target.id } }) === 2);
  await presentationDb.$disconnect();

  r = await call(`/api/targets/${target.id}/presentation`);
  const loaded = r.body;
  check("latest saved presentation reopens without generation", r.status === 200 && loaded.id === generated.presentationId && loaded.original.title === generated.presentation.title && loaded.draft.title === generated.presentation.title && loaded.stale.isStale === false);
  const originalBeforeSave = JSON.stringify(loaded.original);
  const sourceBeforeSave = JSON.stringify(loaded.sourceSnapshot);
  const completeDraft = structuredClone(loaded.draft);
  completeDraft.title = "Saved edited PPTX draft";
  completeDraft.slides[0].speakerNotes = "Saved user notes exported to slide one. No model was called.";
  r = await call(`/api/targets/${target.id}/presentations/${loaded.id}`, json("PATCH", { draft: completeDraft, expectedRevision: loaded.revision }));
  check("complete edited draft is saved before export", r.status === 200 && r.body.revision === 2 && r.body.draft.title === completeDraft.title);

  const beforeExportDb = testDb();
  const beforeExportRecord = await beforeExportDb.interviewPresentationRecord.findUniqueOrThrow({ where: { id: loaded.id } });
  await beforeExportDb.$disconnect();
  r = await call(`/api/targets/${target.id}/presentations/${loaded.id}/export`, json("POST", { expectedRevision: 2 }));
  check("export without human-review acknowledgement → 400", r.status === 400 && /humanReviewed/.test(r.body.error));
  r = await call(`/api/targets/${target.id}/presentations/${loaded.id}/export`, json("POST", { expectedRevision: 2, humanReviewed: false }));
  check("export with false human-review acknowledgement → 400", r.status === 400);
  const exported = await downloadPptx(target.id, loaded.id, 2);
  const packageInfo = exported.bytes ? await inspectPptx(exported.bytes) : null;
  check("saved draft exports as a real PPTX with safe headers", exported.status === 200 && /^attachment;/.test(exported.headers.get("content-disposition") ?? "") && /-r2\.pptx/.test(exported.headers.get("content-disposition") ?? "") && exported.headers.get("x-presentation-revision") === "2");
  check("PPTX contains 4 editable slides from draft, not original", packageInfo?.slides.length === 4 && packageInfo.slideXml.includes("Saved edited PPTX draft") && !packageInfo.slideXml.includes("Mocked interview presentation"));
  check("PPTX embeds project image bytes and preserves speaker notes/provenance", packageInfo?.media.length >= 1 && packageInfo.notes.length === 4 && packageInfo.notesXml.includes("Saved user notes exported to slide one") && packageInfo.notesXml.includes("USER_UPLOADED_UNVERIFIED"));
  const afterExportDb = testDb();
  const afterExportRecord = await afterExportDb.interviewPresentationRecord.findUniqueOrThrow({ where: { id: loaded.id } });
  check("export does not modify draft, original, source snapshot or revision", afterExportRecord.revision === beforeExportRecord.revision && afterExportRecord.draftJson === beforeExportRecord.draftJson && afterExportRecord.originalJson === beforeExportRecord.originalJson && afterExportRecord.sourceSnapshotJson === beforeExportRecord.sourceSnapshotJson);

  const invalidReferenceDraft = structuredClone(completeDraft);
  invalidReferenceDraft.slides[0].sourceIds = ["missing-source-id"];
  await afterExportDb.interviewPresentationRecord.update({ where: { id: loaded.id }, data: { draftJson: JSON.stringify(invalidReferenceDraft) } });
  const invalidReferenceExport = await downloadPptx(target.id, loaded.id, 2);
  check("invalid saved source references are rejected", invalidReferenceExport.status === 422 && /references|source/i.test(invalidReferenceExport.body.error));
  await afterExportDb.interviewPresentationRecord.update({ where: { id: loaded.id }, data: { draftJson: JSON.stringify(completeDraft) } });

  const storedDashboardForExport = await afterExportDb.cvImage.findUniqueOrThrow({ where: { id: dashboard.id } });
  const dashboardPath = path.join(uploadDir, storedDashboardForExport.storedFileName);
  const originalDashboardBytes = readFileSync(dashboardPath);
  writeFileSync(dashboardPath, Buffer.from("not the saved image bytes"));
  const changedBytesExport = await downloadPptx(target.id, loaded.id, 2);
  check("image SHA-256 mismatch is rejected before PPTX generation", changedBytesExport.status === 422 && /SHA-256/.test(changedBytesExport.body.error));
  writeFileSync(dashboardPath, originalDashboardBytes);
  renameSync(dashboardPath, `${dashboardPath}.export-hidden`);
  const missingReferencedImageExport = await downloadPptx(target.id, loaded.id, 2);
  check("missing referenced image blocks export", missingReferencedImageExport.status === 409 && /image information needs review|confirmation/i.test(missingReferencedImageExport.body.error));
  renameSync(`${dashboardPath}.export-hidden`, dashboardPath);

  const fiveSlideDraft = structuredClone(completeDraft);
  fiveSlideDraft.slides.push({ heading: "Questions and close", bullets: ["Synthetic fifth slide for package verification"], speakerNotes: "Fifth slide notes.", sourceIds: [], imageIds: [] });
  const fiveSlideRecord = await afterExportDb.interviewPresentationRecord.create({ data: {
    targetId: target.id,
    originalJson: JSON.stringify(fiveSlideDraft),
    draftJson: JSON.stringify(fiveSlideDraft),
    imageAnalysesJson: JSON.stringify(loaded.imageAnalyses),
    sourceSnapshotJson: JSON.stringify(loaded.sourceSnapshot),
    sourceFingerprint: loaded.sourceFingerprint,
    generatedAt: new Date("2000-01-01T00:00:00.000Z"),
    createdAt: new Date("2000-01-01T00:00:00.000Z"),
  } });
  const fiveSlideExport = await downloadPptx(target.id, fiveSlideRecord.id, 1);
  const fiveSlidePackage = fiveSlideExport.bytes ? await inspectPptx(fiveSlideExport.bytes) : null;
  check("5-slide saved draft exports exactly 5 slides", fiveSlideExport.status === 200 && fiveSlidePackage?.slides.length === 5 && fiveSlidePackage.notes.length === 5);
  await afterExportDb.$disconnect();

  const staleRevisionExport = await downloadPptx(target.id, loaded.id, 1);
  check("export revision conflict is rejected", staleRevisionExport.status === 409 && /revision changed/.test(staleRevisionExport.body.error));
  check("presentation cannot be exported through another target", (await downloadPptx("no-such-target", loaded.id, 2)).status === 404);

  const incompleteDraft = structuredClone(loaded.draft);
  incompleteDraft.title = "Persisted user draft";
  incompleteDraft.slides[0].heading = "";
  incompleteDraft.slides[0].speakerNotes = "Saved user notes that were not semantically re-reviewed.";
  r = await call(`/api/targets/${target.id}/presentations/${loaded.id}`, json("PATCH", { draft: incompleteDraft, expectedRevision: 2 }));
  check("incomplete wording can be explicitly saved", r.status === 200 && r.body.revision === 3 && r.body.draft.slides[0].heading === "");
  check("saving draft does not modify original or source snapshot", JSON.stringify(r.body.original) === originalBeforeSave && JSON.stringify(r.body.sourceSnapshot) === sourceBeforeSave);
  const incompleteExport = await downloadPptx(target.id, loaded.id, 3);
  check("incomplete saved draft cannot be exported", incompleteExport.status === 422 && /incomplete or invalid/.test(incompleteExport.body.error));
  const revisionConflict = await call(`/api/targets/${target.id}/presentations/${loaded.id}`, json("PATCH", { draft: { ...incompleteDraft, title: "Conflicting window" }, expectedRevision: 1 }));
  check("revision conflict does not silently overwrite", revisionConflict.status === 409 && (await call(`/api/targets/${target.id}/presentation`)).body.draft.title === "Persisted user draft");
  check("presentation cannot be saved through another target", (await call(`/api/targets/no-such-target/presentations/${loaded.id}`, json("PATCH", { draft: incompleteDraft, expectedRevision: 3 }))).status === 404);

  const imageDb = testDb();
  const storedDashboard = await imageDb.cvImage.findUniqueOrThrow({ where: { id: dashboard.id } });
  await imageDb.cvImage.update({ where: { id: dashboard.id }, data: { sha256: "0".repeat(64) } });
  r = await call(`/api/targets/${target.id}/presentation`);
  check("changed image bytes mark saved source stale and unavailable", r.body.stale.isStale && r.body.stale.unavailableImageIds.includes(dashboard.id));
  await imageDb.cvImage.update({ where: { id: dashboard.id }, data: { sha256: storedDashboard.sha256 } });
  await imageDb.$disconnect();
  check("restoring identical image metadata clears the image stale state", !(await call(`/api/targets/${target.id}/presentation`)).body.stale.isStale);

  // ── Edited confirmed data ──────────────────────────────────────────────
  console.log("── Editing confirmed data invalidates only what changed");
  const saved = (await call(`/api/cvs/${cv.id}`)).body;
  const { id: _a, createdAt: _b, updatedAt: _c, images: _d, ...input } = saved;
  await call(`/api/cvs/${cv.id}`, json("PUT", input));
  check("re-saving unchanged CV keeps READY", (await payloadOf(target.id)).readiness.isReady);
  await call(`/api/cvs/${cv.id}`, json("PUT", { ...input, experience: input.experience.map((e, i) => (i === 0 ? { ...e, description: e.description + "\nMentored two new interns." } : e)) }));
  p = await payloadOf(target.id);
  check("edit experience → only EXPERIENCE changed", p.candidate.workExperience.confirmation.status === "CHANGED_SINCE_CONFIRMATION" && p.readiness.sections.confirmed === 6 && !p.readiness.isReady);
  check("message explains what to do", p.readiness.issues.some((i) => i.code === "SECTION_CHANGED_SINCE_CONFIRMATION" && i.message === "Work experience was edited after you confirmed it. Review the current version and confirm it again."));
  r = await call(`/api/targets/${target.id}/context?requireReady=true`);
  check("requireReady now refuses (409)", r.status === 409 && r.body.issues[0].section === "EXPERIENCE");
  const failedRegeneration = await generateFromReviewedContext(target.id);
  check("failed regeneration does not delete the latest saved record", failedRegeneration.status === 409 && (await call(`/api/targets/${target.id}/presentation`)).body.id === loaded.id);
  const staleSourceExport = await downloadPptx(target.id, loaded.id, 3);
  check("not-READY or stale source state blocks export", staleSourceExport.status === 409 && /review|confirm|Source changed/i.test(staleSourceExport.body.error));
  const staleDraft = structuredClone(incompleteDraft);
  staleDraft.title = "Persisted after source change";
  r = await call(`/api/targets/${target.id}/presentations/${loaded.id}`, json("PATCH", { draft: staleDraft, expectedRevision: 3 }));
  check("saving wording does not clear source stale state", r.status === 200 && r.body.revision === 4 && r.body.stale.isStale);
  await confirm(target.id, { confirmed: true, sections: ["EXPERIENCE"], expectedFingerprints: { EXPERIENCE: p.fingerprints.EXPERIENCE } });
  await call(`/api/cvs/${cv.id}`, json("PUT", { ...(await call(`/api/cvs/${cv.id}`)).body, skills: [...input.skills].reverse() }));
  p = await payloadOf(target.id);
  check("reordering skills counts as a change", p.candidate.skills.confirmation.status === "CHANGED_SINCE_CONFIRMATION");
  await confirm(target.id, { confirmed: true, sections: ["SKILLS"] });
  await call(`/api/jobs/${job.id}`, json("PUT", { title: "Graduate Software Engineer", companyName: "Harbourline Analytics", companyInfo: "Sydney-based analytics company, ~120 staff.", jobReference: "HLA-GRAD-2026", description: jobText + "Applications close 30 November.\n" }));
  p = await payloadOf(target.id);
  check("edit job text → TARGET_JOB changed", p.targetJob.confirmation.status === "CHANGED_SINCE_CONFIRMATION" && p.readiness.sections.confirmed === 6);
  await confirm(target.id, { confirmed: true, sections: ["TARGET_JOB"] });
  await call(`/api/cvs/${cv.id}/images/${dashboard.id}`, json("PATCH", { caption: "Monthly view" }));
  p = await payloadOf(target.id);
  check("edit image caption → that image changed, sections unaffected", codes(p, "BLOCKING").join() === "IMAGE_CHANGED_SINCE_CONFIRMATION" && p.readiness.sections.confirmed === 7);
  await confirmReviewedImage(cv.id, dashboard.id);
  check("back to READY after re-confirming", (await payloadOf(target.id)).readiness.isReady);

  // ── Invalid associations ───────────────────────────────────────────────
  console.log("── Invalid associations");
  const other = (await call("/api/cvs", json("POST", { ...cvInput, fullName: "Someone Else" }))).body;
  r = await call(`/api/cvs/${cv.id}/images/${mobile.id}`, json("PATCH", { projectId: other.projects[0].id }));
  check("linking an image to another CV's project → 400, nothing changed", r.status === 400 && (await payloadOf(target.id)).readiness.isReady);
  r = await confirmReviewedImage(other.id, mobile.id);
  check("confirming an image through another CV → 404", r.status === 404);
  r = await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: "missing-job" }));
  check("pairing with a missing job → 404 + field error", r.status === 404 && Boolean(r.body.fieldErrors.jobDescriptionId));
  const cur = (await call(`/api/cvs/${cv.id}`)).body;
  const { id: _e, createdAt: _f, updatedAt: _g, images: _h, ...curInput } = cur;
  await call(`/api/cvs/${cv.id}`, json("PUT", { ...curInput, projects: curInput.projects.filter((x) => x.id !== campus.id) }));
  p = await payloadOf(target.id);
  check("deleting a project: its image moves to otherImages and needs re-confirmation", p.candidate.otherImages.some((i) => i.imageId === mobile.id && i.confirmation.status === "CHANGED_SINCE_CONFIRMATION") && p.candidate.projects.confirmation.status === "CHANGED_SINCE_CONFIRMATION");
  await confirm(target.id, { confirmed: true, sections: ["PROJECTS"] });
  await confirmReviewedImage(cv.id, mobile.id);
  check("re-confirmed → READY", (await payloadOf(target.id)).readiness.isReady);

  // ── Missing images ─────────────────────────────────────────────────────
  console.log("── Missing images");
  // Look up this image's stored file name; the folder also holds other suites' files.
  const lookup = testDb();
  const photoFile = (await lookup.cvImage.findUniqueOrThrow({ where: { id: photo.id } })).storedFileName;
  await lookup.$disconnect();
  renameSync(path.join(uploadDir, photoFile), path.join(uploadDir, "..", photoFile + ".hidden"));
  p = await payloadOf(target.id);
  check("missing file → IMAGE_FILE_MISSING blocks readiness", !p.readiness.isReady && p.readiness.issues.some((i) => i.code === "IMAGE_FILE_MISSING" && i.itemId === photo.id) && p.candidate.otherImages.find((i) => i.imageId === photo.id).fileAvailable === false);
  check("requireReady → 409", (await call(`/api/targets/${target.id}/context?requireReady=true`)).status === 409);
  check("review page still renders", (await call(`/prepare/${target.id}`)).status === 200);
  renameSync(path.join(uploadDir, "..", photoFile + ".hidden"), path.join(uploadDir, photoFile));
  check("file restored → READY again", (await payloadOf(target.id)).readiness.isReady);

  // ── Incomplete / invalid stored data ───────────────────────────────────
  console.log("── Invalid stored data is never passed on as valid");
  const db = testDb();
  await db.cvProfile.update({ where: { id: cv.id }, data: { email: "not-an-email" } }); // bypasses API validation
  p = await payloadOf(target.id);
  check("data edited outside the app → PROFILE changed + INVALID_DATA blocking", !p.readiness.isReady && p.readiness.issues.some((i) => i.code === "INVALID_DATA" && i.section === "PROFILE" && /valid email/.test(i.message)));
  await confirm(target.id, { confirmed: true, sections: ["PROFILE"] });
  p = await payloadOf(target.id);
  check("confirming does not hide invalid data (still blocked)", !p.readiness.isReady && codes(p, "BLOCKING").join() === "INVALID_DATA");
  await db.cvProfile.update({ where: { id: cv.id }, data: { email: "alex.morgan@example.com" } });
  await db.$disconnect();
  await confirm(target.id, { confirmed: true, sections: ["PROFILE"] });
  check("fixed + re-confirmed → READY", (await payloadOf(target.id)).readiness.isReady);

  // ── Empty sections ─────────────────────────────────────────────────────
  console.log("── Missing fields / empty sections");
  const sparse = (await call("/api/cvs", json("POST", { ...cvInput, fullName: "Sam Lee", email: "", phone: "", experience: [], projects: [], achievements: [] }))).body;
  const sparseJob = (await call("/api/jobs", json("POST", { title: "", companyName: "", companyInfo: "", jobReference: "", description: jobText }))).body;
  const sparseTarget = (await call("/api/targets", json("POST", { cvProfileId: sparse.id, jobDescriptionId: sparseJob.id }))).body;
  p = await payloadOf(sparseTarget.id);
  const warn = codes(p, "WARNING");
  check("warnings: empty sections, no contact, no job title/company", warn.filter((c) => c === "EMPTY_SECTION").length === 3 && ["NO_CONTACT_DETAILS", "JOB_TITLE_MISSING", "COMPANY_NAME_MISSING"].every((c) => warn.includes(c)));
  await confirm(sparseTarget.id, { confirmed: true });
  p = await payloadOf(sparseTarget.id);
  check("empty sections can be confirmed; warnings never block", p.readiness.isReady && codes(p, "WARNING").length > 0 && p.candidate.projects.items.length === 0);

  // ── Correction flow links ──────────────────────────────────────────────
  console.log("── Correction flow");
  r = await call(`/cv/${cv.id}?returnTo=${encodeURIComponent(`/prepare/${target.id}`)}`);
  check("editor opened from review shows 'Back to review'", r.body.includes("Back to review") && r.body.includes(`/prepare/${target.id}`));
  r = await call(`/cv/${cv.id}?returnTo=${encodeURIComponent("https://evil.example.com")}`);
  // (The raw URL still appears in Next.js's router state; what matters is that no link to it is rendered.)
  check("external returnTo is ignored (no banner, no link)", !r.body.includes("Back to review") && !/href="https?:\/\/evil/.test(r.body));
  r = await call(`/jobs/${job.id}?returnTo=${encodeURIComponent(`/prepare/${target.id}`)}`);
  check("job editor opened from review shows 'Back to review'", r.body.includes("Back to review"));

  // ── Consistency on deletion ────────────────────────────────────────────
  console.log("── Data consistency on deletion");
  await call(`/api/jobs/${sparseJob.id}`, { method: "DELETE" });
  check("deleting the job removes the pairing and its confirmations", (await call(`/api/targets/${sparseTarget.id}/context`)).status === 404);
  await call(`/api/cvs/${sparse.id}`, { method: "DELETE" });
  await call(`/api/cvs/${other.id}`, { method: "DELETE" });
  check("review page of a deleted pairing shows not-found message", (await call(`/prepare/${sparseTarget.id}`)).body.includes("does not exist"));

  finish({ targetId: target.id, cvId: cv.id, jobId: job.id, presentationId: loaded.id });
}
