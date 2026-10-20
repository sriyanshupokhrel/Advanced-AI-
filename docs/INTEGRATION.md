# Integration handover: CV + job + images → multimodal AI

**From:** the CV Builder (foundation and integration layer)
**For:** the multimodal AI processing stage, and anyone building on the CV data
**Contract:** `InterviewPreparationPayload` v2.0, defined in
[`src/types/integration.ts`](../src/types/integration.ts)

This document covers everything needed to read a user's confirmed CV, their
target job and their project images as one structured payload. Every example
response below was captured from the running application, so it matches the
implemented code.

---

## 1. Start the application

Requirements: Node.js 22.18+ (tested with 22.18.0 and 24.11.0) and npm 10+.
Full Windows and macOS instructions are in the [README](../README.md#4-installation-and-running).

```bash
cd cv-builder
npm install                 # installs dependencies and generates the Prisma client
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run db:deploy           # creates prisma/dev.db and applies all migrations
npm run dev                 # http://localhost:3000
```

Production mode: `npm run build`, then `npm start`.

### Database setup

- **Engine:** SQLite, through Prisma ORM 6.19.3. The database file is
  `prisma/dev.db`, set by `DATABASE_URL` in `.env`.
- **Migrations:** they live in `prisma/migrations/`. `npm run db:deploy`
  applies them in order, without prompts. Use `npm run db:migrate` only when
  you change `schema.prisma` and need to create a new migration.
- **Browsing data:** `npm run db:studio` opens a table viewer.
- **Images:** files are stored in `storage/uploads/`. Set `UPLOAD_DIR` in
  `.env` to use another folder. Only metadata is kept in the database.
- **Single user:** there is no login, and every API call sees all data. Do
  not expose the app to a network without adding authentication.

### Checking it works

```bash
npm run check                     # type-check + lint + 59 unit tests
npm run build && npm run test:e2e # 254 end-to-end checks on an isolated test database
```

---

## 2. The one rule

**Only process a payload when `readiness.isReady` is `true`.** Request it
like this so the server enforces the rule:

```
GET /api/targets/{targetId}/context?requireReady=true
```

- `200`: READY. Every section and every image is user-confirmed and unchanged
  since confirmation, and no blocking problem remains.
- `409`: not ready. The body lists what the user still has to do (section 7).
  Send the user to `/prepare/{targetId}` to finish reviewing.

> **"Confirmed" means the user reviewed it.** It does not mean the
> application or the university verified any claim. Every payload carries
> this text in `verificationDisclaimer`, every confirmation has
> `basis: "USER_REVIEW"`, and every image has
> `provenance: "USER_UPLOADED_UNVERIFIED"`. Do not present images or claims as
> proven facts.

---

## 3. How a user reaches READY

```
CV editor (/cv/{id})        Job descriptions (/jobs)        Project images (in each project)
        └──────────────► Prepare interview (/prepare): pair CV + job ◄──────────┘
                                         │
                                         ▼
                       Review page /prepare/{targetId}
   • 7 sections, each confirmed separately:
     PROFILE · EXPERIENCE · EDUCATION · SKILLS · PROJECTS · ACHIEVEMENTS · TARGET_JOB
   • every image confirmed separately (description + project link)
   • "Correct / edit" → editor → "Back to review"
                                         │
                                         ▼
                           readiness.status = "READY"
```

- **Editing invalidates confirmation automatically.** A section's
  confirmation stores a SHA-256 fingerprint of the exact content the user
  saw.
  - Any change (an edited word, an added, removed or reordered item) turns
    that section into `CHANGED_SINCE_CONFIRMATION`, and the payload stops
    being READY.
  - Other sections keep their confirmation.
  - Re-saving unchanged data changes nothing.
- **What an image confirmation covers:** the file (SHA-256), the description,
  caption and kind, the project link, and the linked project's name and
  description.
- **Missing optional information never blocks** (e.g. no achievements, a
  project without images). It is reported as a `WARNING`.

---

## 4. Endpoints for the next stage

| Method & path | Purpose | Success |
| --- | --- | --- |
| **`GET /api/targets/{id}/context`** | **The integration payload** | 200 |
| `GET /api/targets/{id}/context?requireReady=true` | Same, but `409` unless READY | 200 / 409 |
| `GET /api/targets` | List pairings (`CvJobTargetDto[]`); filters `?cvId=`, `?jobId=` | 200 |
| `GET /api/targets/{id}` | One pairing: per-section status + readiness summary | 200 |
| `GET /api/images/{imageId}?v=…` | Image file bytes, with validated `Content-Type` and an `ETag` | 200 / 304 |
| `GET /api/cvs/{id}/image-context?confirmedOnly=true` | Per-image view (`ImageEvidenceContext[]`, v1.0) | 200 |

Endpoints the user interface uses to produce the data (documented in the
README):

- CVs: `/api/cvs`, `/api/cvs/{id}`
- Jobs: `/api/jobs`, `/api/jobs/{id}`
- Images: `/api/cvs/{id}/images`, `/api/cvs/{id}/images/{imageId}`
- Pairing: `POST /api/targets`
- Confirmation: `PATCH /api/targets/{id}`

### Server-side interface (no HTTP)

Inside this Next.js app, call the repository directly:

```ts
import { getInterviewPreparationPayload } from "@/lib/db/target-repository";
import { readImageFile } from "@/lib/storage/image-storage";
import type { InterviewPreparationPayload } from "@/types/integration";

const payload: InterviewPreparationPayload | null = await getInterviewPreparationPayload(targetId);
if (!payload) throw new Error("Pairing not found");
if (!payload.readiness.isReady) {
  /* don't process; payload.readiness.issues explains why */
}
```

To read an image's bytes on the server, look up its stored record with
`findImageRecord(imageId)` from `@/lib/db/image-repository`, then call
`readImageFile(record.storedFileName)`. Over HTTP, fetch `image.url` instead.

---

## 5. Payload structure and fields

A full real example is in
[`integration-payload.example.json`](integration-payload.example.json). It is
regenerated from the API by `npm run test:e2e -- --update-example`.

```text
InterviewPreparationPayload
├─ contractVersion        "2.0"
├─ targetId               pairing id
├─ generatedAt            ISO timestamp of this response
├─ verificationDisclaimer fixed text (section 2)
├─ readiness              { status, isReady, readySince, sections{confirmed,total}, images{confirmed,total}, issues[] }
├─ candidate
│  ├─ cvProfileId, createdAt, lastUpdatedAt
│  ├─ profile             { confirmation, fullName, headline, contact{email,phone,location,website}, professionalSummary }
│  ├─ education           { confirmation, items[] }
│  ├─ workExperience      { confirmation, items[] }
│  ├─ skills              { confirmation, items[] }
│  ├─ projects            { confirmation, items[ {…, images[]} ] }
│  ├─ achievements        { confirmation, items[] }
│  └─ otherImages[]       images not linked to a project
├─ targetJob              { confirmation, jobDescriptionId, jobTitle, company{name,information},
│                           jobReference, descriptionText, createdAt, lastUpdatedAt }
└─ fingerprints           { PROFILE: sha256, …, TARGET_JOB: sha256 }
```

**Conventions**

- Blank optional values are `null` (never `""`).
- Month dates are `"YYYY-MM"`; `…At` fields are ISO 8601 timestamps.
- Lists keep the user's order.
- Ids are stable across edits, reorders and restarts.
- The payload contains no scores, rankings or AI output.

### CV fields (`candidate`)

| Path | Type | Notes |
| --- | --- | --- |
| `profile.fullName` | string | Required |
| `profile.headline` | string \| null | e.g. "Graduate Software Engineer" |
| `profile.contact.email` / `phone` / `location` / `website` | string \| null | `website` is always `http(s)://` |
| `profile.professionalSummary` | string | Required; may contain line breaks |
| `education.items[]` | `id, institution, qualification, fieldOfStudy, startDate, endDate, grade, description` | `qualification` is the degree name |
| `workExperience.items[]` | `id, jobTitle, employer, location, startDate, endDate, isCurrent, description` | `endDate` is `null` when `isCurrent`; descriptions often hold one point per line |
| `skills.items[]` | `id, name, category` | `category` is optional free text |
| `projects.items[]` | `id, name, role, url, technologies, description, images[]` | `technologies` is free text, e.g. "Next.js, Prisma" |
| `achievements.items[]` | `id, title, issuer, date, description` | |

### Job fields (`targetJob`)

| Field | Type | Notes |
| --- | --- | --- |
| `jobDescriptionId` | string | Stable id |
| `jobTitle`, `jobReference` | string \| null | Optional |
| `company.name`, `company.information` | string \| null | Optional |
| `descriptionText` | string | **Verbatim** advert (50–30,000 chars). Spaces, line breaks and symbols are preserved exactly |

### Image fields (`projects.items[].images[]` and `otherImages[]`)

| Field | Notes |
| --- | --- |
| `imageId` | Stable id |
| `kind` | `PROFILE_PHOTO`, `PROJECT_SCREENSHOT`, `CERTIFICATE` or `OTHER` |
| `url` | Relative (prefix the app origin). The `?v=` part changes when the file is replaced, so it is safe to cache by URL |
| `mimeType` | Detected from the file bytes: `image/png`, `image/jpeg`, `image/webp`, `image/gif` |
| `originalFileName`, `sizeBytes` | As uploaded (max 5 MB) |
| `width`, `height` | Pixels, read from the file header |
| `sha256` | Hash of the file; use it to verify the download |
| `fileAvailable` | `false` if the file is missing on disk (this also blocks READY) |
| `description.altText`, `description.caption` | The user's own words. `source` is always `"USER_PROVIDED"` |
| `provenance` | Always `"USER_UPLOADED_UNVERIFIED"` |
| `confirmation` | See below |
| `uploadedAt`, `updatedAt` | ISO timestamps |

### Confirmation metadata

Every section and every image has:

```json
{ "status": "CONFIRMED", "isConfirmed": true, "confirmedAt": "2026-10-20T11:51:16.418Z", "basis": "USER_REVIEW" }
```

| `status` | Meaning |
| --- | --- |
| `NOT_CONFIRMED` | Not yet confirmed by the user |
| `CONFIRMED` | Confirmed, and unchanged since |
| `CHANGED_SINCE_CONFIRMATION` | Confirmed earlier, but edited afterwards. Treat it as unconfirmed |

---

## 6. Example requests and responses (captured from the app)

### 6.1 Retrieve the payload when it is not ready

```http
GET /api/targets/cmvgmh7yv0009mrk83cgb04qu/context?requireReady=true
```

`409 Conflict`:

```json
{
  "error": "This CV and job are not ready: 8 items still need the user's review.",
  "issues": [
    {
      "code": "SECTION_NOT_CONFIRMED",
      "section": "PROFILE",
      "itemId": null,
      "message": "Personal details & summary has not been confirmed yet. Review it and click \"Confirm\".",
      "severity": "BLOCKING"
    },
    "… 6 more SECTION_NOT_CONFIRMED issues (EDUCATION … TARGET_JOB) …",
    {
      "code": "IMAGE_NOT_CONFIRMED",
      "section": "PROJECTS",
      "itemId": "cmvgmh7y10006mrk8hgvxg9a9",
      "message": "Image \"Budget Buddy monthly spending dashboard\" (project \"Budget Buddy\") has not been confirmed. Check its description and project link, then confirm it (or delete it).",
      "severity": "BLOCKING"
    }
  ]
}
```

### 6.2 Pairing status after the user has confirmed everything

```http
GET /api/targets/cmvgmh7yv0009mrk83cgb04qu
```

`200 OK` (`CvJobTargetDto`; sections abbreviated):

```json
{
  "id": "cmvgmh7yv0009mrk83cgb04qu",
  "cv": { "id": "cmvgmh7xd0000mrk8nevwwapd", "fullName": "Alex Morgan", "headline": "Graduate Software Engineer" },
  "job": { "id": "cmvgmh7yh0007mrk8k8lajhk0", "title": "Graduate Software Engineer", "companyName": "Harbourline Analytics", "jobReference": "HLA-GRAD-2026" },
  "confirmationStatus": "CONFIRMED",
  "sections": {
    "PROFILE": { "status": "CONFIRMED", "confirmedAt": "2026-10-20T11:51:16.418Z" },
    "…": "… EDUCATION, EXPERIENCE, SKILLS, PROJECTS, ACHIEVEMENTS, TARGET_JOB (same shape) …"
  },
  "readiness": {
    "status": "READY",
    "isReady": true,
    "blockingIssues": 0,
    "sections": { "confirmed": 7, "total": 7 },
    "images": { "confirmed": 1, "total": 1 }
  },
  "createdAt": "2026-10-20T11:51:16.375Z",
  "updatedAt": "2026-10-20T11:51:16.423Z"
}
```

`GET /api/targets/{id}/context?requireReady=true` then returns `200` with
the full payload; see `integration-payload.example.json`.

### 6.3 How the data is produced (for context)

Uploading a project image:

```http
POST /api/cvs/cmvgmh7xd0000mrk8nevwwapd/images
Content-Type: multipart/form-data

file=@budget-dashboard.png  kind=PROJECT_SCREENSHOT
altText=Budget Buddy monthly spending dashboard  caption=  projectId=cmvgmh7xd0004mrk82q8txnit
```

`201 Created`:

```json
{
  "id": "cmvgmh7y10006mrk8hgvxg9a9",
  "cvProfileId": "cmvgmh7xd0000mrk8nevwwapd",
  "projectId": "cmvgmh7xd0004mrk82q8txnit",
  "kind": "PROJECT_SCREENSHOT",
  "originalName": "budget-dashboard.png",
  "mimeType": "image/png",
  "sizeBytes": 102936,
  "width": 640,
  "height": 480,
  "sha256": "90ce9a3adb8b98b667d6cd9fcd4c092b748744c2b49b20c15ef7d50317d6686d",
  "altText": "Budget Buddy monthly spending dashboard",
  "caption": "",
  "url": "/api/images/cmvgmh7y10006mrk8hgvxg9a9?v=90ce9a3adb8b",
  "confirmationStatus": "NOT_CONFIRMED",
  "confirmedAt": null,
  "createdAt": "2026-10-20T11:51:16.346Z",
  "updatedAt": "2026-10-20T11:51:16.346Z"
}
```

Confirming sections (as the review page does). Send the fingerprints that
were displayed, so only what the user saw is confirmed:

```http
PATCH /api/targets/cmvgmh7yv0009mrk83cgb04qu
Content-Type: application/json

{ "confirmed": true, "sections": ["PROFILE"], "expectedFingerprints": { "PROFILE": "<sha256 from payload.fingerprints>" } }
```

- `sections` may be omitted to mean all seven.
- `confirmed: false` withdraws confirmation.
- Images are confirmed with
  `PATCH /api/cvs/{cvId}/images/{imageId}` and `{ "confirmed": true }`.

---

## 7. Errors

Every non-2xx JSON response has one shape (`ApiErrorBody`,
[`src/types/cv.ts`](../src/types/cv.ts)):

```ts
{
  error: string;                          // plain-language summary
  fieldErrors?: Record<string, string>;   // validation errors by field path
  issues?: ReadinessIssue[];              // only on 409 from …/context?requireReady=true
}
```

| Status | When | Captured example |
| --- | --- | --- |
| 400 | Invalid JSON, or the body failed validation | `{"error":"Some information is missing or invalid.","fieldErrors":{"sections.0":"Each section must be one of: PROFILE, EDUCATION, EXPERIENCE, SKILLS, PROJECTS, ACHIEVEMENTS, TARGET_JOB."}}` |
| 404 | Pairing, CV, job or image not found | `{"error":"CV–job pairing not found."}` |
| 409 | `requireReady=true` and not READY (with `issues`) | see 6.1 |
| 409 | Confirming with fingerprints that no longer match | `{"error":"Personal details & summary changed since this page was loaded. Reload the review page, check the latest version and confirm again."}` |
| 413 | JSON body over 1 MB, or image over 5 MB | `{"error":"Request body is too large (maximum 1 MB)."}` |
| 500 | Unexpected server error (details are only logged on the server) | `{"error":"Something went wrong on the server. Please try again."}` |

Validation error example (`POST /api/cvs`, captured):

```json
{
  "error": "Some information is missing or invalid.",
  "fieldErrors": {
    "fullName": "Full name is required.",
    "email": "Enter a valid email address, e.g. name@example.com.",
    "experience.0.endDate": "End date cannot be before the start date."
  }
}
```

Invalid image upload (a text file renamed `.png`, no description; captured):

```json
{
  "error": "Some information is missing or invalid.",
  "fieldErrors": {
    "altText": "Describe the image in a few words (a description is required).",
    "file": "This file is not a supported image. Upload a PNG, JPEG, WebP or GIF file."
  }
}
```

### Readiness issue codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `SECTION_NOT_CONFIRMED` | BLOCKING | A section has never been confirmed |
| `SECTION_CHANGED_SINCE_CONFIRMATION` | BLOCKING | A confirmed section was edited |
| `IMAGE_NOT_CONFIRMED` | BLOCKING | Image `itemId` has not been confirmed |
| `IMAGE_CHANGED_SINCE_CONFIRMATION` | BLOCKING | Image's file, description, link or linked project changed |
| `IMAGE_FILE_MISSING` | BLOCKING | The image record exists but its file is gone |
| `INVALID_DATA` | BLOCKING | Stored data fails current validation (e.g. edited outside the app); confirming does not clear it |
| `EMPTY_SECTION` | WARNING | A list section has no items |
| `NO_CONTACT_DETAILS` | WARNING | No email and no phone |
| `PROJECT_HAS_NO_IMAGES` | WARNING | Project `itemId` has no images |
| `JOB_TITLE_MISSING`, `COMPANY_NAME_MISSING` | WARNING | Optional job fields are blank |

---

## 8. Connecting the multimodal AI component

The CV Builder ends at a READY payload. The multimodal AI component starts from it.
Recommended flow:

```ts
import type { InterviewPreparationPayload, PayloadImage } from "@/types/integration";

const origin = "http://localhost:3000";

export async function loadConfirmedInput(targetId: string) {
  const res = await fetch(`${origin}/api/targets/${targetId}/context?requireReady=true`);

  if (res.status === 409) {
    const { error, issues } = await res.json();      // ApiErrorBody
    return { ok: false as const, error, issues };     // show issues; link to /prepare/{targetId}
  }
  if (!res.ok) throw new Error((await res.json()).error); // 404 / 500

  const payload: InterviewPreparationPayload = await res.json();

  // Keep each image together with the text of the project it belongs to.
  const images: { image: PayloadImage; projectName: string | null }[] = [
    ...payload.candidate.projects.items.flatMap((p) => p.images.map((image) => ({ image, projectName: p.name }))),
    ...payload.candidate.otherImages.map((image) => ({ image, projectName: null })),
  ];

  const files = await Promise.all(
    images.map(async ({ image, projectName }) => {
      const bytes = new Uint8Array(await (await fetch(`${origin}${image.url}`)).arrayBuffer());
      // Optional integrity check: sha256(bytes) === image.sha256
      return {
        imageId: image.imageId,
        bytes,
        mimeType: image.mimeType,
        userDescription: image.description.altText, // the candidate's claim, not a verified fact
        projectName,
      };
    }),
  );

  return { ok: true as const, payload, files };
}
```

Guidelines:

- **Text inputs:**
  - `candidate.profile`, `workExperience.items`, `projects.items`, etc.
  - the verbatim `targetJob.descriptionText`.
- **Image inputs:** the bytes, plus `mimeType`, `description.altText`,
  `caption` and the owning project's `name` / `description`.
- **Traceability:** store `targetId` and `generatedAt` with every output, so
  generated content can be traced to the exact confirmed input.
- **Re-fetching:** if the user edits their CV later, the payload stops being
  READY, and the input must be re-fetched once the user has confirmed again.
- **Out of scope here:** the CV Builder does not rank, match, caption or
  analyse anything. Those steps belong to the later development stages.

---

## 9. Changes from earlier versions

- **v2.0** (this version) replaces the single pair-level confirmation of
  v1.x with per-section confirmation and a `readiness` verdict.
  - `candidate.images[]` is replaced by images nested in
    `projects.items[].images` plus `otherImages`.
  - `dataQuality.notices` is replaced by `readiness.issues`.
  - `getCvJobContext()` is now `getInterviewPreparationPayload()`.
- Pairs confirmed under v1.x start as `NOT_CONFIRMED` after migrating and
  need one review.
- The unscoped `DELETE /api/images/{id}` was removed. Use
  `DELETE /api/cvs/{cvId}/images/{imageId}`.
- `ImageEvidenceContext` (v1.0) is unchanged.
