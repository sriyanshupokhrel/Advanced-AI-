# Source changes relative to Member 3 commit 4cf4a2d

Generated from exact baseline bytes. Evaluation evidence is listed in `evaluation/integration-2026-10-25/validation.md`.

| Status | File |
| --- | --- |
| MODIFIED | `README.md` |
| ADDED | `TEAM_INTEGRATION.md` |
| MODIFIED | `docs/INTEGRATION.md` |
| MODIFIED | `docs/MEMBER3_HANDOVER.md` |
| MODIFIED | `package-lock.json` |
| MODIFIED | `package.json` |
| ADDED | `prisma/migrations/20261023090000_interview_decks/migration.sql` |
| ADDED | `prisma/migrations/20261025090000_presentation_reliability/migration.sql` |
| MODIFIED | `prisma/schema.prisma` |
| MODIFIED | `src/app/api/cvs/[id]/images/[imageId]/route.ts` |
| MODIFIED | `src/app/api/targets/[id]/generate-interview/route.ts` |
| MODIFIED | `src/app/api/targets/[id]/presentations/[presentationId]/export/route.ts` |
| MODIFIED | `src/components/images/ImageCard.tsx` |
| MODIFIED | `src/components/presentation/PresentationEditor.tsx` |
| MODIFIED | `src/components/presentation/PresentationFlow.tsx` |
| ADDED | `src/components/presentation/ReliabilityPanel.tsx` |
| MODIFIED | `src/components/presentation/SourcePanel.tsx` |
| MODIFIED | `src/lib/ai/ai-pipeline.ts` |
| MODIFIED | `src/lib/ai/claim-review.ts` |
| MODIFIED | `src/lib/ai/content-selector.ts` |
| ADDED | `src/lib/ai/errors.ts` |
| MODIFIED | `src/lib/ai/evidence-checker.ts` |
| MODIFIED | `src/lib/ai/image-analysis.ts` |
| MODIFIED | `src/lib/ai/interview-generator.ts` |
| ADDED | `src/lib/ai/presentation-schema.ts` |
| MODIFIED | `src/lib/ai/prompt-builder.ts` |
| ADDED | `src/lib/ai/provider.ts` |
| ADDED | `src/lib/ai/reliability-pipeline.ts` |
| ADDED | `src/lib/ai/snapshot.ts` |
| MODIFIED | `src/lib/api/api-client.ts` |
| MODIFIED | `src/lib/api/image-upload.ts` |
| MODIFIED | `src/lib/db/image-repository.ts` |
| MODIFIED | `src/lib/db/presentation-repository.ts` |
| MODIFIED | `src/lib/db/target-repository.ts` |
| MODIFIED | `src/lib/presentation/editor-model.ts` |
| MODIFIED | `src/lib/presentation/generation-session.ts` |
| MODIFIED | `src/lib/presentation/pptx-builder.ts` |
| MODIFIED | `src/lib/presentation/pptx-export.ts` |
| ADDED | `src/lib/presentation/reliability-adapter.ts` |
| ADDED | `src/lib/storage/image-decode.ts` |
| MODIFIED | `src/lib/validation/image-schema.ts` |
| MODIFIED | `src/lib/validation/job-schema.ts` |
| MODIFIED | `src/types/cv.ts` |
| MODIFIED | `src/types/interview-generation.ts` |
| ADDED | `src/types/reliability.ts` |
| MODIFIED | `tests/e2e/images.suite.mjs` |
| MODIFIED | `tests/e2e/jobs.suite.mjs` |
| MODIFIED | `tests/e2e/lib.mjs` |
| MODIFIED | `tests/e2e/run.mjs` |
| MODIFIED | `tests/e2e/workflow.suite.mjs` |
| ADDED | `tests/integration/merged-workflow.mjs` |
| MODIFIED | `tests/support/alias-hooks.mjs` |
| ADDED | `tests/support/deck-fixture.mjs` |
| ADDED | `tests/unit/ai-reliability.test.ts` |
| ADDED | `tests/unit/reliability-v2.test.ts` |
| MODIFIED | `tests/unit/sample-data.ts` |

The Member 3 theme, slide preview, icons, development harness, original/draft types, source snapshot model and original migration SQL are preserved. The editor receives small additive reliability-panel and WebP changes; save-during-input protection is retained.
