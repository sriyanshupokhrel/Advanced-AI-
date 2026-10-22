interface E2EMockEnvironment {
  NODE_ENV?: string;
  INTERNAL_E2E_MOCK_AI?: string;
  E2E_BASE_URL?: string;
  DATABASE_URL?: string;
  UPLOAD_DIR?: string;
}

const normalized = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");

/**
 * The model replacement is available only to the repository's isolated E2E
 * process. A lone environment flag in an ordinary dev/start process is not
 * enough to enable it.
 */
export function isIsolatedE2EMockAiEnabled(env: E2EMockEnvironment = process.env): boolean {
  if (
    env.NODE_ENV !== "production" ||
    env.INTERNAL_E2E_MOCK_AI !== "1" ||
    !/^http:\/\/localhost:\d+$/.test(env.E2E_BASE_URL ?? "")
  ) return false;

  const databaseUrl = normalized(env.DATABASE_URL ?? "");
  const uploadDir = normalized(env.UPLOAD_DIR ?? "");
  const match = databaseUrl.match(/^file:(.*\/cv-builder-e2e-[^/]+)\/test\.db$/i);
  return Boolean(match && uploadDir === `${match[1]}/uploads`);
}
