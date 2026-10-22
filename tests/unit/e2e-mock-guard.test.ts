import assert from "node:assert/strict";
import test from "node:test";
import { isIsolatedE2EMockAiEnabled } from "@/lib/ai/e2e-mock-guard";

test("a mock flag alone cannot enable AI replacement in dev or production", () => {
  assert.equal(isIsolatedE2EMockAiEnabled({ NODE_ENV: "development", INTERNAL_E2E_MOCK_AI: "1" }), false);
  assert.equal(isIsolatedE2EMockAiEnabled({ NODE_ENV: "production", INTERNAL_E2E_MOCK_AI: "1" }), false);
});

test("the mock is limited to the isolated E2E database and upload directory", () => {
  const base = {
    NODE_ENV: "production",
    INTERNAL_E2E_MOCK_AI: "1",
    E2E_BASE_URL: "http://localhost:3999",
    DATABASE_URL: "file:C:/Temp/cv-builder-e2e-run123/test.db",
    UPLOAD_DIR: "C:\\Temp\\cv-builder-e2e-run123\\uploads",
  };
  assert.equal(isIsolatedE2EMockAiEnabled(base), true);
  assert.equal(isIsolatedE2EMockAiEnabled({ ...base, DATABASE_URL: "file:./prisma/dev.db" }), false);
  assert.equal(isIsolatedE2EMockAiEnabled({ ...base, UPLOAD_DIR: "storage/uploads" }), false);
  assert.equal(isIsolatedE2EMockAiEnabled({ ...base, E2E_BASE_URL: "https://example.test" }), false);
});
