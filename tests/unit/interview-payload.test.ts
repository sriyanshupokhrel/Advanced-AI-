import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildInterviewPreparationPayload,
  computeSectionFingerprints,
  overallConfirmationStatus,
  resolveConfirmationStatus,
} from "@/lib/integration/interview-payload";
import { REVIEW_SECTIONS } from "@/lib/validation/job-schema";
import { sampleCv, sampleImage, sampleJob } from "./sample-data";

const blocking = (p: ReturnType<typeof buildInterviewPreparationPayload>) =>
  p.readiness.issues.filter((i) => i.severity === "BLOCKING").map((i) => i.code);

/** Confirmation rows for every section, fingerprinted from the given data. */
function confirmAll(cv = sampleCv(), job = sampleJob()) {
  const fingerprints = computeSectionFingerprints(cv, job);
  return REVIEW_SECTIONS.map((section) => ({
    section,
    confirmedHash: fingerprints[section],
    confirmedAt: new Date("2026-10-03T00:00:00.000Z"),
  }));
}

const build = (cv = sampleCv(), job = sampleJob(), confirmations = confirmAll(), missing?: Set<string>) =>
  buildInterviewPreparationPayload({ targetId: "t1", cv, job, confirmations, missingImageIds: missing });

describe("resolveConfirmationStatus", () => {
  test("no stored hash → NOT_CONFIRMED", () => assert.equal(resolveConfirmationStatus(null, "x"), "NOT_CONFIRMED"));
  test("matching hash → CONFIRMED", () => assert.equal(resolveConfirmationStatus("x", "x"), "CONFIRMED"));
  test("different hash → CHANGED_SINCE_CONFIRMATION", () =>
    assert.equal(resolveConfirmationStatus("x", "y"), "CHANGED_SINCE_CONFIRMATION"));
});

describe("section fingerprints", () => {
  test("are 64-char SHA-256 hex for all seven sections", () => {
    const fp = computeSectionFingerprints(sampleCv(), sampleJob());
    assert.deepEqual(Object.keys(fp), [...REVIEW_SECTIONS]);
    for (const value of Object.values(fp)) assert.match(value, /^[0-9a-f]{64}$/);
  });

  test("ignore timestamps (re-saving unchanged data keeps confirmation)", () => {
    const a = computeSectionFingerprints(sampleCv(), sampleJob());
    const b = computeSectionFingerprints(
      sampleCv({ updatedAt: "2030-01-01T00:00:00.000Z" }),
      sampleJob({ updatedAt: "2030-01-01T00:00:00.000Z", targetCount: 9 }),
    );
    assert.deepEqual(a, b);
  });

  test("change only for the edited section", () => {
    const before = computeSectionFingerprints(sampleCv(), sampleJob());
    const after = computeSectionFingerprints(sampleCv({ summary: "Edited." }), sampleJob());
    for (const section of REVIEW_SECTIONS) {
      if (section === "PROFILE") assert.notEqual(after[section], before[section]);
      else assert.equal(after[section], before[section], section);
    }
  });

  test("reordering a list counts as a change", () => {
    const cv = sampleCv();
    const reordered = sampleCv({ skills: [...cv.skills].reverse() });
    assert.notEqual(computeSectionFingerprints(reordered, sampleJob()).SKILLS, computeSectionFingerprints(cv, sampleJob()).SKILLS);
  });

  test("project images are not part of the PROJECTS fingerprint (images are confirmed separately)", () => {
    const without = computeSectionFingerprints(sampleCv(), sampleJob()).PROJECTS;
    const withImage = computeSectionFingerprints(sampleCv({ images: [sampleImage()] }), sampleJob()).PROJECTS;
    assert.equal(withImage, without);
  });

  test("whitespace in the job description is significant (verbatim text)", () => {
    const a = computeSectionFingerprints(sampleCv(), sampleJob()).TARGET_JOB;
    const b = computeSectionFingerprints(sampleCv(), sampleJob({ description: sampleJob().description + " " })).TARGET_JOB;
    assert.notEqual(a, b);
  });
});

describe("readiness", () => {
  test("nothing confirmed → ACTION_REQUIRED with 7 section issues", () => {
    const p = build(sampleCv(), sampleJob(), []);
    assert.equal(p.readiness.status, "ACTION_REQUIRED");
    assert.equal(p.readiness.isReady, false);
    assert.equal(blocking(p).filter((c) => c === "SECTION_NOT_CONFIRMED").length, 7);
    assert.equal(p.readiness.sections.confirmed, 0);
  });

  test("everything confirmed, no images → READY with readySince", () => {
    const p = build();
    assert.equal(p.readiness.status, "READY");
    assert.equal(p.readiness.readySince, "2026-10-03T00:00:00.000Z");
    assert.deepEqual(blocking(p), []);
    assert.equal(overallConfirmationStatus(p), "CONFIRMED");
  });

  test("editing a confirmed section → that section CHANGED, payload not ready", () => {
    const p = build(sampleCv({ summary: "Edited." }), sampleJob(), confirmAll());
    assert.equal(p.candidate.profile.confirmation.status, "CHANGED_SINCE_CONFIRMATION");
    assert.equal(p.candidate.education.confirmation.status, "CONFIRMED");
    assert.deepEqual(blocking(p), ["SECTION_CHANGED_SINCE_CONFIRMATION"]);
    assert.equal(overallConfirmationStatus(p), "CHANGED_SINCE_CONFIRMATION");
    assert.match(p.readiness.issues[0].message, /Personal details & summary was edited after you confirmed it/);
  });

  test("unconfirmed, changed and missing images block readiness", () => {
    const cv = sampleCv({
      images: [
        sampleImage({ id: "a", confirmationStatus: "NOT_CONFIRMED", confirmedAt: null }),
        sampleImage({ id: "b", confirmationStatus: "CHANGED_SINCE_CONFIRMATION" }),
        sampleImage({ id: "c" }),
      ],
    });
    const p = build(cv, sampleJob(), confirmAll(cv), new Set(["c"]));
    assert.deepEqual(blocking(p).sort(), ["IMAGE_CHANGED_SINCE_CONFIRMATION", "IMAGE_FILE_MISSING", "IMAGE_NOT_CONFIRMED"]);
    assert.deepEqual(
      p.readiness.issues.filter((i) => i.severity === "BLOCKING").map((i) => i.itemId).sort(),
      ["a", "b", "c"],
    );
    assert.equal(p.readiness.images.confirmed, 1);
  });

  test("invalid stored data is BLOCKING even when confirmed", () => {
    const cv = sampleCv({ email: "not-an-email" });
    const p = build(cv, sampleJob(), confirmAll(cv));
    assert.deepEqual(blocking(p), ["INVALID_DATA"]);
    assert.equal(p.readiness.issues.find((i) => i.code === "INVALID_DATA")?.section, "PROFILE");
  });

  test("invalid stored job is BLOCKING under TARGET_JOB", () => {
    const job = sampleJob({ description: "too short" });
    const p = build(sampleCv(), job, confirmAll(sampleCv(), job));
    assert.equal(p.readiness.issues.find((i) => i.code === "INVALID_DATA")?.section, "TARGET_JOB");
  });

  test("missing optional information produces WARNINGs that never block", () => {
    const cv = sampleCv({ email: "", phone: "", projects: [], achievements: [] });
    const job = sampleJob({ title: "", companyName: "" });
    const p = build(cv, job, confirmAll(cv, job));
    const warnings = p.readiness.issues.filter((i) => i.severity === "WARNING").map((i) => i.code).sort();
    assert.deepEqual(warnings, ["COMPANY_NAME_MISSING", "EMPTY_SECTION", "EMPTY_SECTION", "JOB_TITLE_MISSING", "NO_CONTACT_DETAILS"]);
    assert.equal(p.readiness.isReady, true);
  });

  test("project without images gets a PROJECT_HAS_NO_IMAGES warning naming the project", () => {
    const issue = build().readiness.issues.find((i) => i.code === "PROJECT_HAS_NO_IMAGES");
    assert.equal(issue?.itemId, "pr1");
    assert.equal(issue?.severity, "WARNING");
  });
});

describe("payload shape", () => {
  test("images are nested in their project; unlinked ones go to otherImages", () => {
    const cv = sampleCv({
      images: [sampleImage({ id: "p" }), sampleImage({ id: "o", projectId: null, kind: "PROFILE_PHOTO" })],
    });
    const p = build(cv);
    assert.deepEqual(p.candidate.projects.items[0].images.map((i) => i.imageId), ["p"]);
    assert.deepEqual(p.candidate.otherImages.map((i) => i.imageId), ["o"]);
  });

  test("an image linked to a project that no longer exists is treated as unlinked", () => {
    const cv = sampleCv({ images: [sampleImage({ id: "x", projectId: "deleted-project" })] });
    const p = build(cv);
    assert.equal(p.candidate.otherImages[0].imageId, "x");
    assert.equal(p.candidate.projects.items[0].images.length, 0);
  });

  test("blank optional values are null, ids and verbatim text preserved", () => {
    const p = build();
    assert.equal(p.candidate.profile.contact.website, null);
    assert.equal(p.candidate.education.items[0].grade, null);
    assert.equal(p.candidate.skills.items[1].category, null);
    assert.equal(p.candidate.workExperience.items[0].id, "ex1");
    assert.equal(p.targetJob.descriptionText, sampleJob().description);
    assert.equal(p.targetJob.company.information, null);
  });

  test("current role has endDate null", () => {
    const cv = sampleCv({
      experience: [{ id: "e", employer: "X", role: "Y", location: "", startDate: "2024-01", endDate: "", isCurrent: true, description: "" }],
    });
    const item = build(cv, sampleJob(), confirmAll(cv)).candidate.workExperience.items[0];
    assert.equal(item.isCurrent, true);
    assert.equal(item.endDate, null);
  });

  test("images carry provenance, user-provided description and confirmation basis", () => {
    const image = build(sampleCv({ images: [sampleImage()] })).candidate.projects.items[0].images[0];
    assert.equal(image.provenance, "USER_UPLOADED_UNVERIFIED");
    assert.equal(image.description.source, "USER_PROVIDED");
    assert.equal(image.confirmation.basis, "USER_REVIEW");
    assert.equal(image.fileAvailable, true);
  });

  test("contract metadata", () => {
    const p = build();
    assert.equal(p.contractVersion, "2.0");
    assert.match(p.verificationDisclaimer, /not been independently verified/);
    assert.equal(p.targetId, "t1");
  });
});
