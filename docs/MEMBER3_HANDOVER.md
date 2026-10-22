# Member 3 handover: interview presentation

Date checked: 22 October 2026
Branch: `member-3-presentation`
Baseline commit under the uncommitted work: `b05803a94bbcc1c9bfa8987df210fbe278c81182`

## Scope and ownership

Member 3 owns the interview-presentation entry, preview/editor, explicit draft
save and reopen flow, source/image display, and editable PPTX export. The visual
layout in `src/components/presentation/` includes Claude's later UI adjustments;
the final integration, persistence, export and acceptance work was performed
against that local UI rather than replacing it.

Member 1 supplies the CV, job, image upload/storage and confirmation workflow.
Member 2 supplies the existing server-side image analysis, evidence selection,
presentation generation and claim-review pipeline. Member 3 calls those
interfaces and does not reimplement their prompts or model logic.

Key files:

- `src/app/prepare/[id]/presentation/page.tsx` and
  `src/components/presentation/PresentationFlow.tsx`: formal flow and states.
- `src/components/presentation/PresentationEditor.tsx`: the shared live/demo
  editor UI and explicit Save/Download interactions.
- `src/app/api/targets/[id]/generate-interview/route.ts`: existing generation
  call followed by server-side original/initial-draft persistence.
- `src/app/api/targets/[id]/presentation/route.ts` and
  `src/app/api/targets/[id]/presentations/[presentationId]/route.ts`: reopen and
  revision-protected draft save.
- `src/app/api/targets/[id]/presentations/[presentationId]/export/route.ts` and
  `src/lib/presentation/pptx-*.ts`: server-side export and verified image bytes.
- `src/lib/db/presentation-repository.ts`: persistence, ownership, revision and
  source-snapshot checks.
- `src/types/presentation.ts` and `src/types/interview-generation.ts`: shared
  complete-output and saveable-draft schemas.

## Data and trust model

Each successful generation creates a separate `InterviewPresentationRecord`
from migration `20261021143000_interview_presentation_records`:

- `originalJson` is the strictly validated model result and is never changed by
  the draft save endpoint.
- `draftJson` begins as a deep serialized copy of the original and may contain
  temporarily incomplete text while the user is editing.
- `revision` starts at 1 and is compared and incremented atomically on Save.
- `sourceSnapshotJson` and `sourceFingerprint` preserve the confirmed CV, job
  and image metadata used for that generation.
- `imageAnalysesJson` preserves the analyses from that same run.

Source/image IDs remain read-only. Save checks that references and slide/bullet
structure still match the original. Reopen compares stable confirmed content
and image SHA-256 values rather than dynamic timestamps. A stale presentation
remains viewable, but saving wording does not clear stale status and export is
blocked. User confirmation and Save do not mean independent fact verification;
user-edited wording is not automatically sent through claim review again.

## Runtime boundaries

- Formal page: `/prepare/{targetId}/presentation`; it never imports demo data or
  falls back to a sample.
- Development-only pages: `/dev/presentation` and `/dev/presentation-flow`;
  both return not-found outside `NODE_ENV=development`.
- Only `POST /api/targets/{id}/generate-interview` calls the AI pipeline.
  Reopen, Save and export do not call Gemini.
- The E2E model replacement requires a production test subprocess plus
  `INTERNAL_E2E_MOCK_AI=1`, a localhost E2E URL, and matching
  `cv-builder-e2e-*` temporary database/upload paths. A URL, request body,
  request header or a lone environment flag cannot enable it.
- Do not place `INTERNAL_E2E_MOCK_AI` in `.env` or `.env.local`.

## Dependencies and migration

- `pptxgenjs` 4.0.1: editable 16:9 PPTX generation.
- `jszip` 3.10.1: in-memory OOXML cleanup/inspection.
- Prisma migration:
  `prisma/migrations/20261021143000_interview_presentation_records/migration.sql`.
- `npm run db:deploy` and the E2E migration subprocess scope `RUST_LOG=info` as
  a workaround for the observed Prisma/SQLite migration-engine issue. They do
  not change global environment settings.

## How another teammate can test Member 3

1. Run `npm install`, copy `.env.example` to an untracked `.env` if needed,
   then run `npm run db:deploy` and `npm run dev`.
2. Create fictional CV/job data and upload a small PNG or JPEG project image.
3. Pair them, open `/prepare/{targetId}`, and confirm every section and image.
4. Put a personal test `GEMINI_API_KEY` in `.env.local`; do not commit it.
5. Confirm that neither `.env` nor `.env.local` defines
   `INTERNAL_E2E_MOCK_AI`. Click Generate exactly once.
6. Check that the generated source IDs and image correspond to the fictional
   records. Edit one bullet and one speaker-note paragraph, then Save.
7. Record the presentation ID and displayed revision. Refresh and reopen the
   route; verify both edits remain without another model request.
8. Download the saved revision. Open it in Microsoft PowerPoint and check that
   text remains editable, images keep their proportions, notes are on the
   correct slides, and the provenance block is separate from the spoken notes.
9. Before team submission, run `npm run check`, `npm run build`,
   `npm run test:e2e`, and `git diff --check`.

Do not automatically retry a failed real generation. Keep a redacted error and
review configuration/readiness first; do not change models, bypass claim review
or fall back to the E2E mock.

## Acceptance record

Automated checks use fictional isolated data and the guarded E2E replacement;
they are not evidence of real Gemini success. At this handover:

- unit/type/lint, production build and isolated E2E were run successfully;
  exact final counts are recorded in the handover report accompanying this file;
- PPTX package structure and four-slide local renderer output were checked;
- browser automation could not initialize because its Windows kernel assets
  path was unavailable;
- no real Gemini request was made;
- the sample was not opened or edited in Microsoft PowerPoint or LibreOffice.

The retained synthetic sample is outside the repository at
`C:\Users\eurus\Documents\Codex\2026-10-21\advanced-ai-assignment-3-c-projects\outputs\member-3-synthetic-interview-r3-validated.pptx`.
It must not be described as real model output.

## Dependency risk record

Both audit commands were executed against the current lockfile and exited 1
because vulnerabilities were reported. No audit fix was run.

| Chain and installed version | Advisory | Direct? | Present with `--omit=dev`? | Project execution path and current action |
| --- | --- | --- | --- | --- |
| `eslint-config-next@16.4.2 → @next/eslint-plugin-next@16.4.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3` | `GHSA-vfj7-8cjw-p6xm` (nested-pattern stack exhaustion) | ESLint config direct dev dependency; remaining packages indirect | No | Used by `npm run lint`, not the application request path. Audit proposes `eslint-config-next@14.2.35`, an incompatible Next-major downgrade; do not apply without a coordinated framework regression. |
| `prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5` | `GHSA-ggr8-5vv4-36mx` (recursive-graph stack exhaustion) | Prisma is direct dev and optional peer of `@prisma/client`; others indirect | Yes, because the installed optional peer chain remains visible | Prisma CLI/config is used for install/generate/migration, not normal presentation HTTP requests. Audit proposes Prisma 7.10.1, a major upgrade requiring schema/client/migration and full E2E validation. |
| `pptxgenjs@4.0.1 → image-size@1.2.1` | `GHSA-5p2g-fcmc-qvqq` (JXL/HEIF loop) and `GHSA-w3rx-r6r6-pgpr` (ICNS loop) | PptxGenJS direct production dependency; image-size indirect | Yes | PPTX export is a server request path. This application accepts only validated PNG/JPEG/GIF bytes for export and supplies dimensions; it does not accept JXL/HEIF/ICNS, which limits but does not erase dependency risk. Audit suggests 4.0.0, but that version declares `image-size ^1.1.1` and is not a demonstrated fix. `image-size` 2.0.4 is outside that major range; test an upstream PptxGenJS fix or a controlled override in a separate dependency change with package, visual, PowerPoint and full E2E regression. |

The audit's totals (10 with dev, 5 without dev) count affected packages along
the dependency chains, not ten independent advisories. Evidence is insufficient
to attribute the count change solely to the export dependencies.

## Known limitations and remaining evidence

- Real Gemini acceptance is pending manual execution.
- Formal browser click/download acceptance is pending; automated API/state
  coverage does not replace it.
- Microsoft PowerPoint open/edit acceptance is pending. The local renderer is a
  separate check.
- PPTX export supports PNG, JPEG and GIF. Referenced WebP blocks export with an
  instruction to convert to PNG/JPEG, re-upload and reconfirm. GIF animation is
  renderer/version dependent.
- There is no login, automatic save, historical-version UI, edited-draft claim
  review, PDF export, theme switcher or drag/reorder feature.

## AI-assisted development record

The editor's visual design was adjusted by Claude before the final integration
work. Codex then inspected the resulting local working tree and implemented or
verified the real API connection, persistence/revision/stale flow, server-side
PPTX export, automated tests, dependency audit and handover documentation.
Automated model-success cases used the clearly labelled E2E replacement. Human
visual inspection covered the bundled renderer output only; real Gemini,
browser automation and Microsoft PowerPoint checks remain unclaimed.
