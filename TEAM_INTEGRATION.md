# Team integration handover — 25 October 2026

## What this package is

An integrated source snapshot based on Member 3's branch
`member-3-presentation`, commit `4cf4a2d81f4fe756d193b4150de2116bcdc36e1d`,
with Member 4's reliability repairs adapted to that implementation.
At inspection, GitHub `main` was `b05803a94bbcc1c9bfa8987df210fbe278c81182`
and did not contain the Member 3 branch. This explains why the earlier Member 4
handoff had a different editor. This package uses the Member 3 editor.

No GitHub commit, branch, pull request or push was created by this integration.
The ZIP is source for team review and integration; report and presentation
slides still need to be included according to the assignment submission brief.

## Preserved contributions

- Member 1: CV/job CRUD, uploads, review/confirmation and integration payload.
- Member 2: the multimodal generation task and pipeline, with Member 4 repairs.
- Member 3: presentation entry and flow; editor, preview and source panel;
  immutable generated original; independent editable draft; explicit Save;
  revision conflicts; restore/regenerate behaviour; reopening; stale-source
  detection; saved-revision PPTX layout, images, notes and provenance.
- Member 4: evaluation and reliability repairs, integration adaptations and
  the new verification evidence listed below. Confirm actual names, student
  IDs and individual contributions with the team before writing the report.

Member 3's protection for typing during a Save request is retained: only the
submitted snapshot becomes saved, and newer local edits remain unsaved.
There is no replacement editor or second active persistence flow.

## Changes and reasons

1. **Generation adapter.** The richer AI output is mapped to Member 3's
   existing title/slide contract. Its original per-field references, complete
   source text, review findings, selection report and model usage are stored
   separately as `reliabilityJson` on `InterviewPresentationRecord`.
2. **Review visibility.** The existing editor now displays the original review
   status and expandable title/slide field references. It explicitly marks
   wording changed since the original. `INCOMPLETE_REVIEW` remains an
   unapproved draft with no accepted findings. `NEEDS_CHANGES` is conspicuous.
   Even complete model review never sets `approved` to true.
3. **Source compatibility.** The source panel/export resolver also recognises
   profile, achievement, target-job and visual source IDs from the AI contract.
   Job requirements and pixels cannot establish candidate qualifications.
4. **Confirmation/generation races.** Section confirmation checks every
   selected fingerprint inside a transaction. Image confirmation requires the
   displayed fingerprint and is separate from edits. Generation sends the
   reviewed snapshot, rechecks it during the pipeline and before persistence.
5. **Image reliability.** Full bounded pixel decoding rejects damaged images;
   model output cannot overwrite trusted image/project IDs or captions or
   create personal skills. Relevance and limitations are retained. Association
   and SHA-256 checks precede analysis and export.
6. **Bounded provider work and useful errors.** Missing target, unconfirmed
   data, stale input, missing key, invalid output, rate limit and timeout have
   typed responses. Calls have a six-request maximum (up to four images plus
   generation and review), a 240-second overall budget and per-call timeouts.
   The previously audited SDK version is pinned; raw provider errors/keys are
   not logged or returned to the browser.
7. **Export adaptation.** The Member 3 layout is retained. Verified WebP is
   converted to PNG in memory; original uploaded bytes are unchanged. Notes
   include the original review status and field reference IDs. Export requires
   explicit human acknowledgement and rechecks source/revision after building.
   Acknowledgement records the user's declaration, not independent verification.
8. **Migration compatibility.** The new nullable column is additive. The old
   Member 4 `InterviewDeck` migration/model is retained only to preserve an
   existing database's migration history and old data. The active editor uses
   `InterviewPresentationRecord`; legacy decks are not silently imported or
   reclassified as reviewed. An old record with no review metadata is labelled
   as needing human review.

## Start on Windows (PowerShell)

Extract the ZIP and open the folder that contains `package.json`.

```powershell
npm.cmd install
# First setup only; do not overwrite an existing local configuration:
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run db:deploy
npm.cmd run dev
```

Open `http://localhost:3000`. Put your own `GEMINI_API_KEY` in `.env.local` on
the server computer and restart the dev server. Do not share the key or commit
local environment files. Prisma reads `DATABASE_URL` from `.env`; the example
uses `file:./dev.db`.

When updating a working installation, first stop the server and back up that
installation's database and uploads. Keep its environment files and user data;
install the new source/dependencies and apply migrations with `db:deploy`.
No reset, force reset or data-deleting migration is required.

## Apply to the team repository

`integration.patch` is a source-only patch against the exact Member 3 commit
above. Keep it outside the checkout when applying it. With a clean checkout:

```bash
git switch -c integration/member3-member4 4cf4a2d81f4fe756d193b4150de2116bcdc36e1d
git apply --check /path/to/integration.patch
git apply /path/to/integration.patch
npm install
npm run db:deploy
npm run check
npm run build
npm run test:ai-mock
npm run test:integration
npm run test:e2e
```

If teammates have made later commits, compare those first and adapt the patch
on a separate branch. Do not replace their newer working tree wholesale.
Review the file manifest and preserved product flow before committing.

## Verification and examples

Current results and exact logs are in `evaluation/integration-2026-10-25/`.
Read `validation.md` there for scope, counts and limitations. The new
`tests/integration/merged-workflow.mjs` runs the actual adapted pipeline with
a process-local mock Gemini transport against temporary data. It verifies
both review metadata and Member 3's persistence/export contracts.

`example-synthetic-reviewed.pptx`, its JSON and
`example-synthetic-image.pptx` were generated by this integrated implementation
from fictional offline fixtures. They are labelled synthetic and do not prove
real AI quality. `evaluation/historical-live/` contains a separately labelled
earlier real-model example and its limitations; it was not regenerated on the
integrated version. An example output can be chosen for the final code ZIP
after the team checks that its labels and claims match the demonstration.

No paid/live model request was made during this integration. Do not describe
offline transport, old live attempts, or package/XML checks as a final live
quality pass, browser click acceptance or PowerPoint visual acceptance.

## Remaining team acceptance

- Independently check every original/draft claim against its sources, especially
  skill proficiency, role fit, notes clauses and image provenance. Fill the
  rubric; model findings do not substitute for human scoring.
- On the unified version, use the browser to generate once, edit, Save, type
  during Save, reload, restore original, test another window's revision conflict,
  change source data and attempt stale export. Check mobile/desktop layout.
- Open the exported PPTX in Microsoft PowerPoint, check all slides and notes,
  images and overflow, and verify that text is editable.
- Record a representative demonstration; finish the team report and slides.
  Confirm the final filenames/group ID and submission packaging against Canvas.
