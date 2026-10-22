// CV Builder: create / read / update / delete, validation, images, pages.
// "full" leaves one CV behind; "verify" checks it survived a server restart.
import { base, check, finish, json, kept, phase } from "./lib.mjs";

const validCv = {
  fullName: "  Test Candidate  ",
  headline: "Graduate Developer",
  email: "test.candidate@example.com",
  phone: "+61 400 000 000",
  location: "Sydney",
  website: "https://example.com",
  summary: "Test summary.",
  education: [{ institution: "Example University", degree: "BSc", fieldOfStudy: "CS", startDate: "2021-02", endDate: "2024-11", grade: "", description: "" }],
  experience: [{ employer: "Example Pty Ltd", role: "Intern", location: "", startDate: "2023-06", endDate: "", isCurrent: true, description: "Line one\nLine two" }],
  skills: [{ name: "TypeScript", category: "Languages" }, { name: "SQL", category: "" }],
  projects: [{ name: "Demo Project", role: "", url: "", technologies: "Next.js", description: "A demo." }],
  achievements: [{ title: "Test Award", issuer: "", date: "2024-01", description: "" }],
};

if (phase === "verify") {
  const id = kept.cvId;
  const res = await fetch(`${base}/api/cvs/${id}`);
  const cv = await res.json();
  check("CV persisted after restart", res.status === 200 && cv.fullName === "Test Candidate", `status ${res.status}`);
  check("children persisted after restart", cv.projects?.length === 2 && cv.images?.length === 1);
  const img = await fetch(`${base}/api/images/${cv.images?.[0]?.id}`);
  check("image file persisted after restart", img.status === 200);
  const page = await fetch(`${base}/cv/${id}/preview`);
  const html = await page.text();
  check("preview page renders saved CV", page.status === 200 && html.includes("Test Candidate"));
  finish();
} else {

// --- Validation -----------------------------------------------------------
let res = await fetch(`${base}/api/cvs`, json("POST", { ...validCv, fullName: " ", email: "not-an-email", website: "javascript:alert(1)", experience: [{ ...validCv.experience[0], isCurrent: false, startDate: "2024-05", endDate: "2023-01" }] }));
let body = await res.json();
check("invalid CV rejected with 400", res.status === 400, JSON.stringify(body.fieldErrors));
check("fullName error", body.fieldErrors?.fullName === "Full name is required.");
check("email error", Boolean(body.fieldErrors?.email));
check("javascript: URL rejected", Boolean(body.fieldErrors?.website));
check("end-before-start error", body.fieldErrors?.["experience.0.endDate"] === "End date cannot be before the start date.");

res = await fetch(`${base}/api/cvs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad json" });
check("malformed JSON rejected with 400", res.status === 400);

// --- Create / read ----------------------------------------------------------
res = await fetch(`${base}/api/cvs`, json("POST", validCv));
const created = await res.json();
check("create returns 201", res.status === 201, created.id);
check("text is trimmed", created.fullName === "Test Candidate");
check("all sections saved", created.education.length === 1 && created.experience.length === 1 && created.skills.length === 2 && created.projects.length === 1 && created.achievements.length === 1);

res = await fetch(`${base}/api/cvs/${created.id}`);
check("get by id", res.status === 200 && (await res.json()).id === created.id);
res = await fetch(`${base}/api/cvs`);
check("list includes CV", (await res.json()).some((c) => c.id === created.id));
res = await fetch(`${base}/api/cvs/does-not-exist`);
check("unknown id → 404", res.status === 404);

// --- Image upload -----------------------------------------------------------
// 1x1 PNG
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const projectId = created.projects[0].id;
let form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "screenshot.png");
form.append("kind", "PROJECT_SCREENSHOT");
form.append("altText", "Test screenshot");
form.append("caption", "");
form.append("projectId", projectId);
res = await fetch(`${base}/api/cvs/${created.id}/images`, { method: "POST", body: form });
const image = await res.json();
check("image upload 201", res.status === 201, JSON.stringify(image).slice(0, 120));

form = new FormData();
form.append("file", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/png" }), "fake.png");
form.append("kind", "OTHER");
form.append("altText", "");
form.append("caption", "");
form.append("projectId", "");
res = await fetch(`${base}/api/cvs/${created.id}/images`, { method: "POST", body: form });
body = await res.json();
check("non-image disguised as PNG rejected", res.status === 400 && Boolean(body.fieldErrors?.file), JSON.stringify(body.fieldErrors));
check("missing alt text rejected", Boolean(body.fieldErrors?.altText));

res = await fetch(`${base}${image.url}`);
check("image served with correct type", res.status === 200 && res.headers.get("content-type") === "image/png" && res.headers.get("x-content-type-options") === "nosniff");

// --- Update ----------------------------------------------------------------
const update = {
  ...validCv,
  summary: "Updated summary.",
  education: [],
  skills: [created.skills[1]], // keep SQL only (with id), drop TypeScript
  projects: [{ ...created.projects[0], name: "Renamed Project" }, { name: "New Project", role: "", url: "https://example.org", technologies: "", description: "New." }],
  experience: created.experience,
  achievements: created.achievements,
};
res = await fetch(`${base}/api/cvs/${created.id}`, json("PUT", update));
const updated = await res.json();
check("update 200", res.status === 200);
check("scalar field updated", updated.summary === "Updated summary.");
check("removed items deleted", updated.education.length === 0 && updated.skills.length === 1 && updated.skills[0].name === "SQL");
check("existing project kept its id", updated.projects[0].id === projectId && updated.projects[0].name === "Renamed Project");
check("new project created", updated.projects.length === 2 && Boolean(updated.projects[1].id));
check("image still linked to project", updated.images[0]?.projectId === projectId);

// An id belonging to nothing must not be accepted
res = await fetch(`${base}/api/cvs/${created.id}`, json("PUT", { ...update, skills: [{ id: "foreign-id", name: "X", category: "" }] }));
check("foreign item id → 409, transaction rolled back", res.status === 409);
res = await fetch(`${base}/api/cvs/${created.id}`);
check("data unchanged after rejected update", (await res.json()).skills.length === 1);

// --- Delete -----------------------------------------------------------------
res = await fetch(`${base}/api/cvs`, json("POST", { ...validCv, fullName: "Delete Me" }));
const temp = await res.json();
res = await fetch(`${base}/api/cvs/${temp.id}`, { method: "DELETE" });
check("delete 204", res.status === 204);
res = await fetch(`${base}/api/cvs/${temp.id}`);
check("deleted CV → 404", res.status === 404);

// --- Pages --------------------------------------------------------------------
for (const path of ["/", "/cv/new", `/cv/${created.id}`, `/cv/${created.id}/preview`]) {
  res = await fetch(`${base}${path}`);
  check(`page ${path} → 200`, res.status === 200);
}
res = await fetch(`${base}/dev/presentation`);
check("development presentation demo is unavailable in production", res.status === 404);
res = await fetch(`${base}/dev/presentation-flow`);
check("development generation harness is unavailable in production", res.status === 404);
res = await fetch(`${base}/`);
check("home page lists saved CV", (await res.text()).includes("Test Candidate"));

// --- Request hardening -----------------------------------------------------
res = await fetch(`${base}/api/cvs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validCv, summary: "x".repeat(1_100_000) }) });
check("JSON body over 1 MB → 413 (refused before parsing)", res.status === 413);
res = await fetch(`${base}/api/cvs`, { method: "POST", headers: { "Content-Type": "application/json" } });
check("empty body → 400", res.status === 400);
res = await fetch(`${base}/api/images/${image.id}`, { method: "DELETE" });
check("legacy unscoped DELETE /api/images/{id} removed → 405", res.status === 405);

finish({ cvId: created.id });
}
