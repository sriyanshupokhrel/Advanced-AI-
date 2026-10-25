// Runs the actual integrated pipeline with a test-only Gemini transport.
// Temporary database/uploads only. No .env loading and no provider network calls.
import { register } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import JSZip from "jszip";
const dir = mkdtempSync(path.join(os.tmpdir(), "merged-interview-"));
mkdirSync("evaluation/integration-2026-10-25", { recursive: true });
process.env.DATABASE_URL = "file:" + path.join(dir, "test.db");
process.env.UPLOAD_DIR = path.join(dir, "uploads");
process.env.GEMINI_API_KEY = "mock-only";
process.env.RUST_LOG = "info";
delete process.env.INTERNAL_E2E_MOCK_AI;
mkdirSync(process.env.UPLOAD_DIR);
const legacy = path.join(dir, "baseline");
mkdirSync(legacy);
cpSync("prisma/schema.prisma", path.join(legacy, "schema.prisma"));
cpSync("prisma/migrations", path.join(legacy, "migrations"), { recursive: true });
rmSync(path.join(legacy, "migrations/20261025090000_presentation_reliability"), { recursive: true });
function migrate(schema) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", schema], { env: process.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
migrate(path.join(legacy, "schema.prisma"));
register("../support/alias-hooks.mjs", import.meta.url);
register("../../evaluation/mock-hooks.mjs", import.meta.url);
const { createCv, updateCv } = await import("../../src/lib/db/cv-repository.ts");
const { createJob } = await import("../../src/lib/db/job-repository.ts");
const { createTarget, setSectionConfirmations, getInterviewPreparationPayload } = await import("../../src/lib/db/target-repository.ts");
const { createImage, updateImage, getImageForCv } = await import("../../src/lib/db/image-repository.ts");
const { decodeImage } = await import("../../src/lib/storage/image-decode.ts");
const { prisma } = await import("../../src/lib/db/prisma.ts");
const { runInterviewAIPipeline } = await import("../../src/lib/ai/ai-pipeline.ts");
const { createPresentationRecord, getLatestPresentationRecord, savePresentationDraft } = await import("../../src/lib/db/presentation-repository.ts");
const { preparePresentationExport, buildPresentationPptx } = await import("../../src/lib/presentation/pptx-export.ts");
const { contextSnapshotKey } = await import("../../src/lib/presentation/source-snapshot.ts");
const { toEditorPresentation } = await import("../../src/lib/presentation/reliability-adapter.ts");
const { validateGenerationResponse, validateSavedPresentationRecord } = await import("../../src/lib/presentation/generation-session.ts");
const { ExportPresentationRequestSchema } = await import("../../src/types/interview-generation.ts");
const { testDeck, testReview } = await import("../support/deck-fixture.mjs");
globalThis.__requests = []; globalThis.__responses = [];
let failures = 0, count = 0;
async function check(name, fn) {
  try { await fn(); count++; console.log("PASS MERGED " + name); }
  catch (error) { failures++; console.error("FAIL MERGED " + name, error.stack); }
}
const cvInput = { fullName: "Fictional Integration Candidate", headline: "Graduate analyst", email: "fixture@example.com", phone: "", location: "", website: "", summary: "Graduate with an academic data project.", education: [], experience: [], achievements: [], skills: [{ name: "SQL", category: "" }], projects: [{ name: "Academic chart", role: "Student", url: "", technologies: "SQL", description: "Prepared a chart using sample data." }] };
let saved;
try {
  const cv = await createCv(cvInput), job = await createJob({ title: "Data Analyst", companyName: "", companyInfo: "", jobReference: "", description: "Analyse sales data and prepare clear charts using SQL and communicate findings to stakeholders." });
  const { target } = await createTarget(cv.id, job.id);
  const legacyText = JSON.stringify({ title: "Legacy original", slides: [] });
  await prisma.$executeRawUnsafe('INSERT INTO "InterviewPresentationRecord" ("id","targetId","originalJson","draftJson","imageAnalysesJson","sourceSnapshotJson","sourceFingerprint","revision","generatedAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)', "legacy-fixture", target.id, legacyText, legacyText, "[]", "{}", "legacy", 3, new Date(), new Date());
  await prisma.interviewDeck.create({ data: { targetId: target.id, sourceSnapshot: "legacy", outputJson: "legacy-member4", version: 2 } });
  const before = await prisma.cvProfile.findUnique({ where: { id: cv.id } });
  await prisma.$disconnect();
  migrate("prisma/schema.prisma");
  await check("additive upgrade preserves CV, Member 3 original/draft/revision and legacy Member 4 data", async () => {
    assert.deepEqual(await prisma.cvProfile.findUnique({ where: { id: cv.id } }), before);
    const record = await prisma.interviewPresentationRecord.findUnique({ where: { id: "legacy-fixture" } });
    assert.equal(record.originalJson, legacyText); assert.equal(record.draftJson, legacyText); assert.equal(record.revision, 3); assert.equal(record.reliabilityJson, null);
    assert.equal((await prisma.interviewDeck.findUnique({ where: { targetId: target.id } })).outputJson, "legacy-member4");
    await prisma.interviewPresentationRecord.delete({ where: { id: "legacy-fixture" } });
  });
  await check("missing/unconfirmed targets return typed errors before transport", async () => {
    await assert.rejects(runInterviewAIPipeline("missing"), e => e.status === 404);
    await assert.rejects(runInterviewAIPipeline(target.id), e => e.status === 409 && e.code === "NOT_CONFIRMED");
    assert.equal(globalThis.__requests.length, 0);
  });
  let payload = await getInterviewPreparationPayload(target.id);
  await check("missing and partial confirmation tokens are refused", async () => {
    await assert.rejects(setSectionConfirmations(target.id, { confirmed: true }), /changed since/);
    await assert.rejects(setSectionConfirmations(target.id, { confirmed: true, expectedFingerprints: { PROFILE: payload.fingerprints.PROFILE } }), /changed since/);
  });
  await setSectionConfirmations(target.id, { confirmed: true, expectedFingerprints: payload.fingerprints });
  payload = await getInterviewPreparationPayload(target.id);
  await check("missing/stale generation snapshots are refused before transport", async () => {
    for (const token of [undefined, "stale"]) await assert.rejects(runInterviewAIPipeline(target.id, token), e => e.code === "STALE_SELECTION");
    assert.equal(globalThis.__requests.length, 0);
  });
  await check("missing key returns 503 without a provider request", async () => {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(runInterviewAIPipeline(target.id, contextSnapshotKey(payload)), e => e.status === 503 && e.code === "MISSING_KEY");
    assert.equal(globalThis.__requests.length, 0); process.env.GEMINI_API_KEY = "mock-only";
  });
  let deck = testDeck(payload);
  globalThis.__responses = [deck, testReview(payload, deck)];
  let generated = await runInterviewAIPipeline(target.id, contextSnapshotKey(payload));
  await check("real pipeline adapter preserves all original text and per-field review in existing editor contract", () => {
    assert.deepEqual(generated.generation.presentation, toEditorPresentation(deck));
    assert.deepEqual(generated.generation.reliability.original, deck);
    assert.equal(generated.generation.reliability.review.approved, false);
    assert.equal(generated.generation.reliability.metadata.calls, 2);
  });
  saved = await createPresentationRecord({ targetId: target.id, original: generated.generation.presentation, imageAnalyses: generated.generation.imageAnalyses, sourceSnapshot: generated.sourceSnapshot, generatedAt: generated.generation.generatedAt, reliability: generated.generation.reliability });
  await check("generated and reopened reviewed records pass Member 3 response validation", () => {
    assert.equal(validateGenerationResponse({ ...generated.generation, presentationId: saved.id, revision: saved.revision, updatedAt: saved.updatedAt }, target.id, payload).ok, true);
    assert.equal(validateSavedPresentationRecord(saved, target.id).ok, true);
  });
  const originalJson = JSON.stringify(saved.original), reviewJson = JSON.stringify(saved.reliability), sourceJson = JSON.stringify(saved.sourceSnapshot);
  let draft = structuredClone(saved.draft); draft.slides[0].speakerNotes += " User wording added after generation.";
  await check("editing/saving/reopening preserves immutable original, review metadata and source snapshot", async () => {
    saved = await savePresentationDraft({ targetId: target.id, presentationId: saved.id, draft, expectedRevision: 1 });
    assert.equal(saved.revision, 2); assert.deepEqual(saved.draft, draft);
    assert.equal(JSON.stringify(saved.original), originalJson); assert.equal(JSON.stringify(saved.reliability), reviewJson); assert.equal(JSON.stringify(saved.sourceSnapshot), sourceJson);
  });
  await check("outdated save cannot overwrite a newer draft", async () => {
    await assert.rejects(savePresentationDraft({ targetId: target.id, presentationId: saved.id, draft, expectedRevision: 1 }), /another window/);
    assert.deepEqual((await getLatestPresentationRecord(target.id)).record.draft, draft);
  });
  await check("source/image references remain immutable during a wording save", async () => {
    const altered = structuredClone(draft); altered.slides[0].sourceIds = ["foreign"];
    await assert.rejects(savePresentationDraft({ targetId: target.id, presentationId: saved.id, draft: altered, expectedRevision: 2 }), /must remain unchanged/);
  });
  const exportInput = () => ({ targetId: target.id, presentationId: saved.id, expectedRevision: saved.revision });
  await check("export acknowledgement must be explicitly true", () => {
    assert.equal(ExportPresentationRequestSchema.safeParse({ expectedRevision: 2 }).success, false);
    assert.equal(ExportPresentationRequestSchema.safeParse({ expectedRevision: 2, humanReviewed: false }).success, false);
    assert.equal(ExportPresentationRequestSchema.safeParse({ expectedRevision: 2, humanReviewed: true }).success, true);
  });
  await check("integrated PPTX uses saved draft, full notes, original review status and field references", async () => {
    const bytes = await buildPresentationPptx(await preparePresentationExport(exportInput()));
    const zip = await JSZip.loadAsync(bytes), names = Object.keys(zip.files);
    assert.equal(names.filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 4);
    const notes = await zip.file("ppt/notesSlides/notesSlide1.xml").async("string");
    assert.ok(notes.includes(draft.slides[0].speakerNotes)); assert.ok(notes.includes("HUMAN_REVIEW_REQUIRED")); assert.ok(notes.includes("Original field slide.0.bullet.0"));
    writeFileSync("evaluation/integration-2026-10-25/example-synthetic-reviewed.pptx", bytes);
    writeFileSync("evaluation/integration-2026-10-25/example-synthetic-reviewed.json", JSON.stringify({ label: "Synthetic offline integration fixture; no live model called", original: saved.original, draft: saved.draft, reliability: saved.reliability }, null, 2));
  });
  await check("revision and source changes block export", async () => {
    await assert.rejects(preparePresentationExport({ ...exportInput(), expectedRevision: 1 }), /revision changed/);
    await updateCv(cv.id, { ...cvInput, summary: "Edited after confirmation." });
    assert.equal((await getLatestPresentationRecord(target.id)).record.stale.isStale, true);
    await assert.rejects(preparePresentationExport(exportInput()), /needs review/);
  });
  payload = await getInterviewPreparationPayload(target.id);
  await setSectionConfirmations(target.id, { confirmed: true, expectedFingerprints: payload.fingerprints });
  payload = await getInterviewPreparationPayload(target.id);
  await check("source change during a model call discards the result", async () => {
    const changingDeck = testDeck(payload);
    globalThis.__responses = [async () => { await updateCv(cv.id, { ...cvInput, summary: "Changed during generation." }); return changingDeck; }, testReview(payload, changingDeck)];
    await assert.rejects(runInterviewAIPipeline(target.id, contextSnapshotKey(payload)), e => e.code === "STALE_GENERATION");
  });
  payload = await getInterviewPreparationPayload(target.id);
  await setSectionConfirmations(target.id, { confirmed: true, expectedFingerprints: payload.fingerprints });
  payload = await getInterviewPreparationPayload(target.id);
  deck = testDeck(payload); globalThis.__responses = [deck, { findings: [] }];
  generated = await runInterviewAIPipeline(target.id, contextSnapshotKey(payload));
  await check("incomplete reviewer is preserved as explicitly unapproved human-review draft", () => {
    assert.equal(generated.generation.reliability.review.status, "INCOMPLETE_REVIEW");
    assert.equal(generated.generation.reliability.review.approved, false); assert.equal(generated.generation.reliability.review.coverageComplete, false);
    assert.deepEqual(generated.generation.reliability.review.findings, []);
  });
  // Genuine decodable WebP exercises upload, confirmation, visual analysis and conversion.
  const bytes = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
  const decoded = await decodeImage(bytes); assert.ok(decoded.ok);
  const currentProject = payload.candidate.projects.items[0];
  let image = await createImage({ cvProfileId: cv.id, metadata: { kind: "PROJECT_SCREENSHOT", altText: "Synthetic chart fixture", caption: "", projectId: currentProject.id }, bytes, inspected: decoded.image, originalName: "synthetic.webp" });
  await check("image confirmation rejects omitted/stale tokens and combined edits", async () => {
    for (const input of [{ confirmed: true }, { confirmed: true, expectedFingerprint: "0".repeat(64) }, { confirmed: true, expectedFingerprint: image.reviewFingerprint, caption: "Unreviewed edit" }]) await assert.rejects(updateImage(cv.id, image.id, input), e => e.code === "STALE_IMAGE_REVIEW");
  });
  image = await updateImage(cv.id, image.id, { confirmed: true, expectedFingerprint: image.reviewFingerprint });
  payload = await getInterviewPreparationPayload(target.id);
  const analysis = { imageId: image.id, projectId: currentProject.id, projectName: currentProject.name, visibleFeatures: ["Synthetic visible pixels"], relevance: "relevant", relevanceReason: "Test fixture only", presentationCaption: "Synthetic visible pixels", limitations: ["No proof of authorship"] };
  deck = testDeck(payload, [analysis]);
  globalThis.__responses = [{ ...analysis, imageId: "forged", projectId: "forged", relevantSkills: ["AWS"], presentationCaption: "forged" }, deck, testReview(payload, deck, [analysis])];
  generated = await runInterviewAIPipeline(target.id, contextSnapshotKey(payload));
  await check("image model fields cannot replace trusted IDs/caption or invent skills in editor response", () => {
    const actual = generated.generation.imageAnalyses[0]; assert.equal(actual.imageId, image.id); assert.equal(actual.projectId, currentProject.id); assert.deepEqual(actual.relevantSkills, []); assert.equal(actual.presentationCaption, "Synthetic visible pixels");
  });
  saved = await createPresentationRecord({ targetId: target.id, original: generated.generation.presentation, imageAnalyses: generated.generation.imageAnalyses, sourceSnapshot: generated.sourceSnapshot, generatedAt: generated.generation.generatedAt, reliability: generated.generation.reliability });
  await check("WebP source is hash-verified, converted to PNG, embedded without changing original bytes", async () => {
    const prepared = await preparePresentationExport(exportInput());
    assert.equal(prepared.images.get(image.id).mimeType, "image/png");
    const record = await prisma.cvImage.findUnique({ where: { id: image.id } });
    assert.deepEqual(readFileSync(path.join(process.env.UPLOAD_DIR, record.storedFileName)), bytes);
    const pptx = await buildPresentationPptx(prepared), zip = await JSZip.loadAsync(pptx);
    assert.ok(Object.keys(zip.files).some(name => /^ppt\/media\/.*\.png$/.test(name)));
    writeFileSync("evaluation/integration-2026-10-25/example-synthetic-image.pptx", pptx);
  });
  await check("reopen after disconnect keeps original, draft and review metadata", async () => {
    await prisma.$disconnect(); const reopened = (await getLatestPresentationRecord(target.id)).record;
    assert.deepEqual(reopened.original, saved.original); assert.deepEqual(reopened.draft, saved.draft); assert.deepEqual(reopened.reliability, saved.reliability);
    assert.equal(validateSavedPresentationRecord(reopened, target.id).ok, true);
    assert.equal((await getImageForCv(cv.id, image.id)).confirmationStatus, "CONFIRMED");
  });
} finally {
  await prisma.$disconnect(); delete process.env.GEMINI_API_KEY;
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Merged integration: ${count} passed, ${failures} failed. Provider network requests: 0 (transport replaced in this process only).`);
process.exitCode = failures ? 1 : 0;
