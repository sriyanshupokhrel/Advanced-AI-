// Project images: upload validation, content inspection, CV scoping, previews,
// confirmation, replacement, missing files, the image evidence contract.
// "full" leaves one confirmed image behind; "verify" checks it after a restart.
import { renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { confirmReviewedImage, confirmReviewedSections, base, call, check, filesOnDisk, finish, fixture, json, kept, phase, sha, testDb, uploadDir } from "./lib.mjs";

const b64 = (s) => Buffer.from(s, "base64");

function uploadForm(bytes, fileName, type, meta = {}) {
  const form = new FormData();
  if (bytes) form.append("file", new Blob([bytes], { type }), fileName);
  const fields = { kind: "PROJECT_SCREENSHOT", altText: "Test screenshot", caption: "", projectId: "", ...meta };
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return { method: "POST", body: form };
}
const upload = (cvId, bytes, fileName, type, meta) => call(`/api/cvs/${cvId}/images`, uploadForm(bytes, fileName, type, meta));

// Small valid images in each format (1×1), from widely used reference encodings.
const WEBP_LOSSY = b64("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
const WEBP_LOSSLESS = b64("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
const WEBP_EXTENDED = b64("UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==");
const GIF = b64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
// PNG signature + IHDR claiming a given size, no pixel data needed for header checks.
function pngHeader(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); b[24] = 8; b[25] = 2;
  return b;
}

const baseCv = {
  fullName: "Image Test Candidate", headline: "", email: "", phone: "", location: "", website: "",
  summary: "Testing images.", education: [], experience: [], skills: [], achievements: [],
  projects: [
    { name: "Budget App", role: "", url: "", technologies: "React", description: "A budgeting app." },
    { name: "Robot Arm", role: "", url: "", technologies: "", description: "A robotics project." },
  ],
};

if (phase === "verify") {
  const { cvId, imageId, sha256: expectedSha } = kept;
  const r = await call(`/api/cvs/${cvId}/image-context`);
  const ctx = r.body?.find((c) => c.imageId === imageId);
  check("image record + confirmation persisted after restart", r.status === 200 && ctx?.confirmation.status === "CONFIRMED" && ctx.project?.name === "Budget App");
  const file = await fetch(base + ctx.resource.url);
  const bytes = Buffer.from(await file.arrayBuffer());
  check("image file served after restart, bytes intact", file.status === 200 && sha(bytes) === expectedSha);
  const page = await call(`/cv/${cvId}`);
  check("editor page renders with project images after restart", page.status === 200 && page.body.includes("Project images"));
  finish();
} else {
  console.log("── Setup");
  let r = await call("/api/cvs", json("POST", baseCv));
  const cv = r.body;
  const [budget, robot] = cv.projects;
  check("CV with two projects created", r.status === 201 && cv.projects.length === 2);
  const other = (await call("/api/cvs", json("POST", { ...baseCv, fullName: "Other Person" }))).body;

  console.log("── Valid uploads (format detected from content)");
  const jpg = fixture("photo-280x175.jpg");
  r = await upload(cv.id, jpg, "photo.jpg", "image/jpeg", { projectId: budget.id, altText: "Dashboard photo" });
  const jpgImage = r.body;
  check("JPEG → 201, image/jpeg, 280×175 (matches Windows decoder)", r.status === 201 && jpgImage.mimeType === "image/jpeg" && jpgImage.width === 280 && jpgImage.height === 175, JSON.stringify(r.body).slice(0, 160));
  check("SHA-256 recorded correctly", jpgImage.sha256 === sha(jpg));
  check("linked to the right project and CV", jpgImage.projectId === budget.id && jpgImage.cvProfileId === cv.id);
  check("new image starts NOT_CONFIRMED", jpgImage.confirmationStatus === "NOT_CONFIRMED");
  check("URL is versioned", /^\/api\/images\/[^?]+\?v=[0-9a-f]{12}$/.test(jpgImage.url), jpgImage.url);

  const png = fixture("diagram-640x480.png");
  r = await upload(cv.id, png, "diagram.png", "image/png", { projectId: budget.id });
  check("PNG → 201, 640×480", r.status === 201 && r.body.mimeType === "image/png" && r.body.width === 640 && r.body.height === 480);
  const pngImage = r.body;
  r = await upload(cv.id, fixture("photo-1920x1200.jpg"), "wide.jpg", "image/jpeg", { projectId: robot.id });
  check("large JPEG → 1920×1200 (matches Windows decoder)", r.status === 201 && r.body.width === 1920 && r.body.height === 1200);
  for (const [label, bytes] of [["WebP lossy", WEBP_LOSSY], ["WebP lossless", WEBP_LOSSLESS], ["WebP extended", WEBP_EXTENDED]]) {
    r = await upload(cv.id, bytes, "x.webp", "image/webp", { projectId: robot.id });
    check(`${label} → 201, image/webp, 1×1`, r.status === 201 && r.body.mimeType === "image/webp" && r.body.width === 1 && r.body.height === 1, JSON.stringify(r.body.fieldErrors ?? ""));
  }
  r = await upload(cv.id, GIF, "x.gif", "image/gif", { kind: "OTHER" });
  check("GIF (not linked to a project) → 201", r.status === 201 && r.body.mimeType === "image/gif" && r.body.projectId === null);
  const gifImage = r.body;
  r = await upload(cv.id, jpg, "really-a-jpeg.png", "image/png", { kind: "OTHER" });
  check("JPEG named .png is stored as image/jpeg (content wins over name)", r.status === 201 && r.body.mimeType === "image/jpeg");
  const misnamed = r.body;
  r = await upload(cv.id, jpg, "C:\\fakepath\\..\\..\\evil.jpg", "image/jpeg", { kind: "OTHER" });
  check("path in original filename is stripped", r.status === 201 && r.body.originalName === "evil.jpg", r.body.originalName);
  await call(`/api/cvs/${cv.id}/images/${r.body.id}`, { method: "DELETE" });
  check("stored file names are server-generated UUIDs", filesOnDisk().every((f) => /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(f)));

  console.log("── Invalid files");
  r = await upload(cv.id, Buffer.from("just some text pretending to be an image"), "fake.png", "image/png");
  check("text file named .png → 400 not supported", r.status === 400 && /not a supported image/.test(r.body.fieldErrors.file), r.body.fieldErrors?.file);
  r = await upload(cv.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml");
  check("SVG with script → 400", r.status === 400 && Boolean(r.body.fieldErrors.file));
  r = await upload(cv.id, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("garbage after the signature....")]), "broken.png", "image/png");
  check("PNG signature but no header → 400 damaged", r.status === 400 && /damaged or incomplete/.test(r.body.fieldErrors.file));
  r = await upload(cv.id, jpg.subarray(0, 12), "truncated.jpg", "image/jpeg");
  check("truncated JPEG → 400 damaged", r.status === 400 && /damaged/.test(r.body.fieldErrors.file));
  r = await upload(cv.id, pngHeader(20000, 100), "huge.png", "image/png");
  check("20000 px wide → 400 dimension limit", r.status === 400 && /maximum is 10,000/.test(r.body.fieldErrors.file), r.body.fieldErrors?.file);
  r = await upload(cv.id, pngHeader(9000, 9000), "bomb.png", "image/png");
  check("81-megapixel 'decompression bomb' → 400", r.status === 400 && /40 megapixels/.test(r.body.fieldErrors.file));
  r = await upload(cv.id, Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 + 1 - png.length)]), "big.png", "image/png");
  check("5 MB + 1 byte → 400 size limit", r.status === 400 && /5 MB or smaller/.test(r.body.fieldErrors.file));
  r = await upload(cv.id, Buffer.concat([png, Buffer.alloc(7 * 1024 * 1024)]), "bigger.png", "image/png");
  check("7 MB → 413 refused before reading", r.status === 413);
  r = await upload(cv.id, null, "", "", {});
  check("no file → 400", r.status === 400 && r.body.fieldErrors.file === "Choose an image file to upload.");
  r = await upload(cv.id, png, "p.png", "image/png", { altText: "  " });
  check("blank description → 400", r.status === 400 && Boolean(r.body.fieldErrors.altText));
  r = await upload(cv.id, png, "p.png", "image/png", { kind: "SELFIE" });
  check("unknown kind → 400", r.status === 400 && Boolean(r.body.fieldErrors.kind));
  r = await call(`/api/cvs/${cv.id}/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("non-multipart body → 400", r.status === 400);
  r = await upload("no-such-cv", png, "p.png", "image/png");
  check("upload to unknown CV → 404", r.status === 404);

  console.log("── Cross-CV protection");
  r = await upload(cv.id, png, "p.png", "image/png", { projectId: other.projects[0].id });
  check("linking to another CV's project → 400", r.status === 400 && /does not belong to this CV/.test(r.body.fieldErrors.projectId));
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", { projectId: other.projects[0].id }));
  check("moving an image to another CV's project → 400", r.status === 400 && Boolean(r.body.fieldErrors.projectId));
  r = await call(`/api/cvs/${other.id}/images/${jpgImage.id}`, json("PATCH", { altText: "hijack" }));
  check("PATCH via the wrong CV → 404", r.status === 404);
  r = await call(`/api/cvs/${other.id}/images/${jpgImage.id}`, { method: "DELETE" });
  check("DELETE via the wrong CV → 404 (image kept)", r.status === 404 && (await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`)).status === 200);
  const replaceForm = new FormData();
  replaceForm.append("file", new Blob([png], { type: "image/png" }), "x.png");
  r = await call(`/api/cvs/${other.id}/images/${jpgImage.id}`, { method: "PUT", body: replaceForm });
  check("replace via the wrong CV → 404", r.status === 404);

  console.log("── Unsafe file access");
  for (const p of ["/api/images/..%2F..%2F.env", "/api/images/..%2F..%2Fprisma%2Fdev.db", "/api/images/%2E%2E%2Fpackage.json"]) {
    r = await call(p);
    check(`GET ${p} → 404`, r.status === 404);
  }
  r = await call(`/api/cvs/${cv.id}/images/..%2F..%2F.env`);
  check("scoped image route with traversal id → 404", r.status === 404);

  console.log("── Serving and previews");
  let res = await fetch(base + jpgImage.url);
  let served = Buffer.from(await res.arrayBuffer());
  check("served bytes identical to upload", res.status === 200 && sha(served) === sha(jpg));
  check("validated content type + nosniff + CSP sandbox", res.headers.get("content-type") === "image/jpeg" && res.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(res.headers.get("content-security-policy")));
  res = await fetch(base + jpgImage.url, { headers: { "If-None-Match": `"${jpgImage.sha256}"` } });
  check("ETag revalidation → 304", res.status === 304);
  res = await fetch(base + misnamed.url);
  check("misnamed JPEG served as image/jpeg", res.headers.get("content-type") === "image/jpeg");
  r = await call(`/cv/${cv.id}`);
  check("editor page shows project galleries and image previews", r.status === 200 && r.body.includes("Project images") && r.body.includes(jpgImage.url.replace("&", "&amp;").split("?")[0]));
  r = await call(`/cv/${cv.id}/preview`);
  check("CV preview page includes project image", r.status === 200 && r.body.includes(`/api/images/${jpgImage.id}`));

  console.log("── Multiple images per project + limits");
  let budgetCount = 2;
  while (budgetCount < 6) {
    r = await upload(cv.id, fixture("screen-300x200.png"), `extra${budgetCount}.png`, "image/png", { projectId: budget.id });
    if (r.status !== 201) break;
    budgetCount++;
  }
  check("6 images on one project accepted", budgetCount === 6);
  r = await upload(cv.id, png, "seventh.png", "image/png", { projectId: budget.id });
  check("7th image on the project → 400 limit", r.status === 400 && /at most 6 images/.test(r.body.fieldErrors.projectId));
  r = await call(`/api/cvs/${cv.id}/images/${gifImage.id}`, json("PATCH", { projectId: budget.id }));
  check("moving an image into a full project → 400", r.status === 400 && /at most 6/.test(r.body.fieldErrors.projectId));

  console.log("── Descriptions, confirmation and replacement");
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", {}));
  check("empty PATCH → 400", r.status === 400);
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", { altText: "Budget dashboard, monthly view", caption: "Built with React" }));
  check("edit description + caption", r.status === 200 && r.body.altText === "Budget dashboard, monthly view" && r.body.caption === "Built with React");
  r = await confirmReviewedImage(cv.id, jpgImage.id);
  check("confirm → CONFIRMED", r.body.confirmationStatus === "CONFIRMED" && Boolean(r.body.confirmedAt));
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", { caption: "Built with React and Chart.js" }));
  check("editing caption → CHANGED_SINCE_CONFIRMATION", r.body.confirmationStatus === "CHANGED_SINCE_CONFIRMATION");
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", { caption: "Built with React", confirmed: true }));
  check("edit + confirm in one request is refused without changing the saved text", r.status === 409 && (await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`)).body.caption === "Built with React and Chart.js");
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, json("PATCH", { caption: "Built with React" }));
  r = await confirmReviewedImage(cv.id, jpgImage.id);
  check("save edits, then confirm the reviewed version → CONFIRMED", r.status === 200 && r.body.confirmationStatus === "CONFIRMED");

  // Project text is part of what was confirmed.
  const saved = (await call(`/api/cvs/${cv.id}`)).body;
  const { id: _a, createdAt: _b, updatedAt: _c, images: _d, ...cvInput } = saved;
  await call(`/api/cvs/${cv.id}`, json("PUT", cvInput));
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`);
  check("re-saving the CV unchanged keeps the image CONFIRMED", r.body.confirmationStatus === "CONFIRMED");
  await call(`/api/cvs/${cv.id}`, json("PUT", { ...cvInput, projects: cvInput.projects.map((p) => (p.id === budget.id ? { ...p, description: "A budgeting app (rewritten)." } : p)) }));
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`);
  check("rewriting the linked project → image CHANGED_SINCE_CONFIRMATION", r.body.confirmationStatus === "CHANGED_SINCE_CONFIRMATION");
  r = await confirmReviewedImage(cv.id, jpgImage.id);
  const beforeReplace = r.body;

  const oldFiles = new Set(filesOnDisk());
  const newBytes = fixture("screen-300x200.png");
  const form = new FormData();
  form.append("file", new Blob([newBytes], { type: "image/png" }), "replacement.png");
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, { method: "PUT", body: form });
  const replaced = r.body;
  check("replace file → 200, same id, description and project kept", r.status === 200 && replaced.id === jpgImage.id && replaced.altText === beforeReplace.altText && replaced.projectId === budget.id);
  check("replacement metadata updated (PNG 300×200, new hash)", replaced.mimeType === "image/png" && replaced.width === 300 && replaced.sha256 === sha(newBytes) && replaced.originalName === "replacement.png");
  check("replacing → CHANGED_SINCE_CONFIRMATION", replaced.confirmationStatus === "CHANGED_SINCE_CONFIRMATION");
  check("URL version changed (no stale cache)", replaced.url !== beforeReplace.url);
  const nowFiles = new Set(filesOnDisk());
  check("old file deleted, exactly one new file written", nowFiles.size === oldFiles.size && [...nowFiles].filter((f) => !oldFiles.has(f)).length === 1);
  served = Buffer.from(await (await fetch(base + replaced.url)).arrayBuffer());
  check("new bytes are served", sha(served) === sha(newBytes));
  const badForm = new FormData();
  badForm.append("file", new Blob([Buffer.from("not an image")], { type: "image/png" }), "bad.png");
  r = await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`, { method: "PUT", body: badForm });
  check("replacing with an invalid file → 400, original kept", r.status === 400 && (await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`)).body.sha256 === sha(newBytes));
  r = await confirmReviewedImage(cv.id, jpgImage.id);
  r = await confirmReviewedImage(cv.id, pngImage.id);
  r = await call(`/api/cvs/${cv.id}/images/${pngImage.id}`, json("PATCH", { confirmed: false }));
  check("withdraw → NOT_CONFIRMED", r.body.confirmationStatus === "NOT_CONFIRMED" && r.body.confirmedAt === null);

  console.log("── Image evidence contract");
  r = await call(`/api/cvs/${cv.id}/image-context`);
  const all = r.body;
  const ev = all.find((c) => c.imageId === jpgImage.id);
  check("contract → 200, one entry per image", r.status === 200 && all.length === (await call(`/api/cvs/${cv.id}/images`)).body.length);
  check("identifiers", ev.contractVersion === "1.0" && ev.imageId === jpgImage.id && ev.cvProfileId === cv.id && ev.projectId === budget.id);
  check("resource: url, validated type, original name, size, dims, hash, available", ev.resource.url === replaced.url && ev.resource.mimeType === "image/png" && ev.resource.originalFileName === "replacement.png" && ev.resource.width === 300 && ev.resource.sha256 === sha(newBytes) && ev.resource.available === true);
  check("user description marked USER_PROVIDED", ev.description.altText === "Budget dashboard, monthly view" && ev.description.source === "USER_PROVIDED");
  check("provenance: USER_UPLOADED_UNVERIFIED", ev.provenance === "USER_UPLOADED_UNVERIFIED");
  check("confirmation status included", ev.confirmation.status === "CONFIRMED" && ev.confirmation.isConfirmed === true);
  check("related project information included", ev.project?.id === budget.id && ev.project.name === "Budget App" && ev.project.description === "A budgeting app (rewritten)." && ev.project.technologies === "React");
  r = await call(`/api/cvs/${cv.id}/image-context?confirmedOnly=true`);
  check("?confirmedOnly=true returns only confirmed images", r.body.length === 1 && r.body[0].imageId === jpgImage.id);
  r = await call(`/api/cvs/${cv.id}/image-context?projectId=${robot.id}`);
  check("?projectId= filter", r.body.length === 4 && r.body.every((c) => c.projectId === robot.id));
  r = await call(`/api/cvs/no-such-cv/image-context`);
  check("unknown CV → 404", r.status === 404);

  console.log("── CV–job contract integration");
  const job = (await call("/api/jobs", json("POST", { title: "Dev", companyName: "Co", companyInfo: "", jobReference: "", description: "A job description that is comfortably longer than fifty characters." }))).body;
  const target = (await call("/api/targets", json("POST", { cvProfileId: cv.id, jobDescriptionId: job.id }))).body;
  await confirmReviewedSections(target.id);
  r = await call(`/api/targets/${target.id}/context`);
  let ctx = r.body;
  const allImages = (c) => [...c.candidate.projects.items.flatMap((p) => p.images), ...c.candidate.otherImages];
  const ctxImg = ctx.candidate.projects.items.find((p) => p.id === budget.id).images.find((i) => i.imageId === jpgImage.id);
  check("payload v2.0 nests images in their project with metadata + confirmation", ctx.contractVersion === "2.0" && ctxImg.width === 300 && ctxImg.provenance === "USER_UPLOADED_UNVERIFIED" && ctxImg.confirmation.isConfirmed === true && ctxImg.fileAvailable === true);
  check("every image appears exactly once", allImages(ctx).length === (await call(`/api/cvs/${cv.id}/images`)).body.length);
  check("IMAGE_NOT_CONFIRMED issue for unconfirmed images", ctx.readiness.issues.some((n) => n.code === "IMAGE_NOT_CONFIRMED" && n.severity === "BLOCKING"));
  await confirmReviewedImage(cv.id, pngImage.id);
  r = await call(`/api/targets/${target.id}`);
  check("confirming an image leaves all sections CONFIRMED", Object.values(r.body.sections).every((s) => s.status === "CONFIRMED"));
  await call(`/api/cvs/${cv.id}/images/${pngImage.id}`, json("PATCH", { altText: "Architecture diagram" }));
  r = await call(`/api/targets/${target.id}`);
  check("changing an image description → pair CHANGED_SINCE_CONFIRMATION", r.body.confirmationStatus === "CHANGED_SINCE_CONFIRMATION");

  console.log("── Missing files handled gracefully");
  // Look up this image's stored file name rather than guessing from the folder,
  // which may hold other CVs' files.
  const db = testDb();
  const gifFile = (await db.cvImage.findUniqueOrThrow({ where: { id: gifImage.id } })).storedFileName;
  await db.$disconnect();
  renameSync(path.join(uploadDir, gifFile), path.join(uploadDir, "..", gifFile + ".hidden"));
  r = await call(gifImage.url);
  check("missing file → 404 JSON, not a crash", r.status === 404 && r.body.error === "Image file not found.");
  r = await call(`/api/cvs/${cv.id}/image-context`);
  check("contract reports available: false", r.body.find((c) => c.imageId === gifImage.id).resource.available === false);
  r = await call(`/api/targets/${target.id}/context`);
  check("payload: fileAvailable false + blocking IMAGE_FILE_MISSING issue", r.body.candidate.otherImages.find((i) => i.imageId === gifImage.id).fileAvailable === false && r.body.readiness.issues.some((n) => n.code === "IMAGE_FILE_MISSING" && n.itemId === gifImage.id));
  r = await call(`/cv/${cv.id}`);
  check("editor page still renders", r.status === 200);
  const fixForm = new FormData();
  fixForm.append("file", new Blob([GIF], { type: "image/gif" }), "restored.gif");
  r = await call(`/api/cvs/${cv.id}/images/${gifImage.id}`, { method: "PUT", body: fixForm });
  check("replacing a missing file restores it", r.status === 200 && (await fetch(base + r.body.url)).status === 200);
  unlinkSync(path.join(uploadDir, "..", gifFile + ".hidden")); // the moved-away original is now an orphan

  console.log("── Unlinking, project deletion, image deletion");
  r = await call(`/api/cvs/${cv.id}/images/${misnamed.id}`, json("PATCH", { projectId: robot.id }));
  check("link an unlinked image to a project", r.body.projectId === robot.id);
  r = await call(`/api/cvs/${cv.id}/images/${misnamed.id}`, json("PATCH", { projectId: "" }));
  check("projectId \"\" unlinks", r.status === 200 && r.body.projectId === null);
  const robotImages = (await call(`/api/cvs/${cv.id}/image-context?projectId=${robot.id}`)).body.map((c) => c.imageId);
  const current = (await call(`/api/cvs/${cv.id}`)).body;
  const { id: _e, createdAt: _f, updatedAt: _g, images: _h, ...cur } = current;
  r = await call(`/api/cvs/${cv.id}`, json("PUT", { ...cur, projects: cur.projects.filter((p) => p.id !== robot.id) }));
  const afterDelete = r.body.images.filter((i) => robotImages.includes(i.id));
  check("deleting a project keeps its images, unlinked", afterDelete.length === robotImages.length && afterDelete.every((i) => i.projectId === null));

  const before = filesOnDisk().length;
  r = await call(`/api/cvs/${cv.id}/images/${pngImage.id}`, { method: "DELETE" });
  check("delete image → 204, file removed from disk", r.status === 204 && filesOnDisk().length === before - 1);
  r = await call(`/api/cvs/${cv.id}/images/${pngImage.id}`, { method: "DELETE" });
  check("deleting again → 404", r.status === 404);
  check("deleted image no longer served", (await call(pngImage.url)).status === 404);

  console.log("── Deleting a CV removes all its image files");
  const tmp = (await call("/api/cvs", json("POST", { ...baseCv, fullName: "Temp" }))).body;
  await upload(tmp.id, png, "a.png", "image/png", { projectId: tmp.projects[0].id });
  await upload(tmp.id, jpg, "b.jpg", "image/jpeg");
  const withTmp = filesOnDisk().length;
  await call(`/api/cvs/${tmp.id}`, { method: "DELETE" });
  check("2 files removed with the CV", filesOnDisk().length === withTmp - 2);
  await call(`/api/cvs/${other.id}`, { method: "DELETE" });
  await call(`/api/jobs/${job.id}`, { method: "DELETE" });

  const keep = (await call(`/api/cvs/${cv.id}/images/${jpgImage.id}`)).body;
  finish({ cvId: cv.id, imageId: jpgImage.id, sha256: keep.sha256 });
}
