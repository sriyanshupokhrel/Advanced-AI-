// Shared helpers for the end-to-end suites. Suites are run by tests/e2e/run.mjs,
// which starts the production server against an isolated database and upload
// folder and passes their locations through environment variables.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = process.env.E2E_BASE_URL;
export const uploadDir = process.env.UPLOAD_DIR;
export const projectDir = fileURLToPath(new URL("../../", import.meta.url));
export const fixturesDir = fileURLToPath(new URL("../fixtures/", import.meta.url));
/** "full" runs the suite; "verify" re-checks data after a server restart. */
export const phase = process.argv[2] ?? "full";
/** Data the "full" phase asked to keep, for the "verify" phase. */
export const kept = process.argv[3] ? JSON.parse(process.argv[3]) : {};

if (!base || !uploadDir) {
  console.error("Run the suites through `npm run test:e2e` (tests/e2e/run.mjs).");
  process.exit(2);
}

let failures = 0;

/** Records one assertion. Output lines start with PASS or FAIL (parsed by the runner). */
export function check(label, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
}

export const section = (title) => console.log(`── ${title}`);

export const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** fetch() against the app; parses JSON bodies, leaves HTML as text. */
export async function call(p, init) {
  const res = await fetch(base + p, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

export const sha = (buf) => createHash("sha256").update(buf).digest("hex");
export const fixture = (name) => readFileSync(path.join(fixturesDir, name));
export const filesOnDisk = () => readdirSync(uploadDir).filter((f) => f !== ".gitkeep");

/** A Prisma client bound to the same isolated test database as the server. */
export function testDb() {
  const { PrismaClient } = createRequire(path.join(projectDir, "package.json"))("@prisma/client");
  return new PrismaClient();
}

/** Ends the suite: prints the data to keep for "verify" and sets the exit code. */
export function finish(keep = {}) {
  console.log(`KEEP ${JSON.stringify(keep)}`);
  process.exitCode = failures ? 1 : 0;
}
