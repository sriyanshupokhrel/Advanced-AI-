import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cvSchema, toFieldErrors } from "@/lib/validation/cv-schema";
import { imageMetadataSchema, imageUpdateSchema } from "@/lib/validation/image-schema";
import { cvJobTargetSchema, jobDescriptionSchema, targetConfirmationSchema } from "@/lib/validation/job-schema";

const validCv = () => ({
  fullName: "  Alex Morgan  ",
  headline: "",
  email: "alex@example.com",
  phone: "+61 400 123 456",
  location: "",
  website: "https://example.com",
  summary: "Summary.",
  education: [{ institution: "UTS", degree: "BEng", fieldOfStudy: "", startDate: "2022-02", endDate: "2025-11", grade: "", description: "" }],
  experience: [{ employer: "X", role: "Intern", location: "", startDate: "2024-11", endDate: "2025-02", isCurrent: false, description: "" }],
  skills: [{ name: "SQL", category: "" }],
  projects: [{ name: "P", role: "", url: "", technologies: "", description: "D" }],
  achievements: [{ title: "A", issuer: "", date: "", description: "" }],
});

const errorsFor = (input: unknown) => {
  const result = cvSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("CV validation", () => {
  test("a valid CV passes and text is trimmed", () => {
    const result = cvSchema.safeParse(validCv());
    assert.ok(result.success);
    assert.equal(result.data.fullName, "Alex Morgan");
  });

  test("required fields have clear messages", () => {
    const errors = errorsFor({ ...validCv(), fullName: "   ", summary: "" });
    assert.equal(errors.fullName, "Full name is required.");
    assert.equal(errors.summary, "Professional summary is required.");
  });

  test("invalid email, phone and unsafe link", () => {
    const errors = errorsFor({ ...validCv(), email: "nope", phone: "call me", website: "javascript:alert(1)" });
    assert.match(errors.email, /valid email/);
    assert.match(errors.phone, /Phone number/);
    assert.match(errors.website, /http:\/\/ or https:\/\//);
  });

  test("errors are keyed by item path", () => {
    const cv = validCv();
    cv.experience[0] = { ...cv.experience[0], role: "", startDate: "2025-05", endDate: "2025-01" };
    const errors = errorsFor(cv);
    assert.equal(errors["experience.0.role"], "Job title is required.");
    assert.equal(errors["experience.0.endDate"], "End date cannot be before the start date.");
  });

  test("current role must not have an end date; past roles must", () => {
    const cv = validCv();
    cv.experience = [
      { ...cv.experience[0], isCurrent: true, endDate: "2025-02" },
      { ...cv.experience[0], isCurrent: false, endDate: "" },
    ];
    const errors = errorsFor(cv);
    assert.match(errors["experience.0.endDate"], /Leave the end date empty/);
    assert.match(errors["experience.1.endDate"], /required unless this is your current role/);
  });

  test("month fields must be YYYY-MM", () => {
    const cv = validCv();
    cv.education[0].startDate = "2022-13";
    assert.match(errorsFor(cv)["education.0.startDate"], /YYYY-MM/);
  });

  test("list sizes are capped", () => {
    const cv = { ...validCv(), skills: Array.from({ length: 101 }, (_, i) => ({ name: `S${i}`, category: "" })) };
    assert.match(errorsFor(cv).skills, /up to 100 skills/);
  });

  test("unknown keys (e.g. clientKey) are stripped", () => {
    const result = cvSchema.safeParse({ ...validCv(), skills: [{ name: "SQL", category: "", clientKey: "k" }] });
    assert.ok(result.success);
    assert.equal("clientKey" in result.data.skills[0], false);
  });
});

describe("job description validation", () => {
  const job = (description: string) => ({ title: " Dev ", companyName: "", companyInfo: "", jobReference: "", description });

  test("description is stored verbatim (not trimmed); short fields are trimmed", () => {
    const text = "  \n\tLeading spaces, tabs, CRLF\r\n and emoji 😀 must survive exactly as pasted.  \n";
    const result = jobDescriptionSchema.safeParse(job(text));
    assert.ok(result.success);
    assert.equal(result.data.description, text);
    assert.equal(result.data.title, "Dev");
  });

  test("empty, whitespace-only and too-short descriptions are rejected", () => {
    for (const [text, pattern] of [
      ["", /Paste the job description/],
      [" ".repeat(200), /Paste the job description/],
      ["Short advert.", /too short/],
    ] as const) {
      const result = jobDescriptionSchema.safeParse(job(text));
      assert.equal(result.success, false);
      if (!result.success) assert.match(toFieldErrors(result.error).description, pattern);
    }
  });

  test("over 30,000 characters is rejected", () => {
    assert.equal(jobDescriptionSchema.safeParse(job("x".repeat(30_001))).success, false);
  });

  test("pairing requires both ids", () => {
    const result = cvJobTargetSchema.safeParse({});
    assert.equal(result.success, false);
    if (!result.success) assert.deepEqual(Object.keys(toFieldErrors(result.error)).sort(), ["cvProfileId", "jobDescriptionId"]);
  });
});

describe("confirmation request validation", () => {
  const ok = (body: unknown) => targetConfirmationSchema.safeParse(body).success;
  test("accepts all / some sections with fingerprints", () => {
    assert.ok(ok({ confirmed: true }));
    assert.ok(ok({ confirmed: false, sections: ["SKILLS"] }));
    assert.ok(ok({ confirmed: true, sections: ["PROFILE"], expectedFingerprints: { PROFILE: "a".repeat(64) } }));
  });
  test("rejects bad input", () => {
    assert.equal(ok({ confirmed: "yes" }), false);
    assert.equal(ok({ confirmed: true, sections: [] }), false);
    assert.equal(ok({ confirmed: true, sections: ["SALARY"] }), false);
    assert.equal(ok({ confirmed: true, expectedFingerprints: { PROFILE: "abc" } }), false);
    assert.equal(ok({ confirmed: true, expectedFingerprints: { SALARY: "a".repeat(64) } }), false);
  });
});

describe("image metadata validation", () => {
  test("description (alt text) is required; kind must be known", () => {
    const result = imageMetadataSchema.safeParse({ kind: "SELFIE", altText: " ", caption: "", projectId: "" });
    assert.equal(result.success, false);
    if (!result.success) assert.deepEqual(Object.keys(toFieldErrors(result.error)).sort(), ["altText", "kind"]);
  });
  test("an empty PATCH is rejected", () => {
    assert.equal(imageUpdateSchema.safeParse({}).success, false);
    assert.ok(imageUpdateSchema.safeParse({ confirmed: true }).success);
  });
});
