# Integrated snapshot validation — 25 October 2026

Baseline: `member-3-presentation`, `4cf4a2d81f4fe756d193b4150de2116bcdc36e1d`.
Runtime: Node 24.22.1, Linux. These are new results for the integrated snapshot;
earlier Member 3/4 counts have not been added to them.

| Check | Result | Evidence |
| --- | --- | --- |
| Type generation and TypeScript | PASS | `check.log`, `typecheck.log` |
| ESLint | PASS, no lint warnings | `check.log`, `lint.log` |
| Unit tests | 98 passed, 0 failed | `check.log`; original standalone `unit.log` |
| Production Next.js build | PASS | `build.log` |
| AI mock regression cases | 35 passed, 0 failed | `mock.log` |
| New integrated pipeline/database/export cases | 19 passed, 0 failed | `merged-integration.log` |
| Production-server API/workflow assertions | 289 passed, 0 failed | `e2e.log` |
| Actual server stop/restart and persistence | PASS, included in the 289 assertions | E2E verify phases |
| Additive migration with legacy Member 3/4 records | PASS, included in the 19 cases | `merged-integration.log` |
| PPTX reparse, slide/notes/media and draft content | PASS, included in integration/unit/API tests | Above logs and synthetic PPTX examples |
| Browser click/layout/download acceptance | NOT TESTED | Chrome was absent; attempted download returned a truncated archive. No browser results claimed |
| PowerPoint/LibreOffice open/edit and visual acceptance | NOT TESTED | No compatible installed renderer/editor for this run |
| Final integrated real Gemini output quality | NOT TESTED | Zero live/paid provider requests in this run |
| Independent human claim/rubric scoring | PENDING | `../ai_output_rubric.md` |

All automated data changes were restricted to temporary databases/uploads.
No uploaded real user database, image or environment/key file was used.
The E2E runner uses the existing guarded synthetic pipeline; the separate
19-case suite instead runs the actual integrated pipeline and substitutes
only the provider transport. Both are offline tests, not real-model evidence.

The integrated suite verifies snapshot rejection, missing-key handling,
metadata/field-reference persistence, original/draft independence, save
conflicts, immutable references, export acknowledgement, stale-source
blocking, in-flight source changes, incomplete reviewer fallback, image
identity protection and verified WebP-to-PNG export.

The synthetic `.pptx`/JSON examples are reproducible offline integration
fixtures. Historical real-model output is kept in `../historical-live/` and
is explicitly outside the current test counts. Its known quality issues and
pending human checks still apply.

Reproduce from the project root:

```bash
npm install
npm run check
npm run test:ai-mock
npm run test:integration
npm run build
npm run test:e2e
```

`test:integration` enables Node's experimental type transformation only for
that test process. It sets a test-only key string and intercepts the SDK in a
process-local loader; it never reads `.env` or sends a provider request.
