// End-to-end test runner.
//
//   npm run build && npm run test:e2e
//
// 1. Creates a temporary folder with a fresh SQLite database (all migrations
//    applied) and an empty upload folder. Your dev database and uploads are
//    never touched.
// 2. Starts the production server (`next start`) against them.
// 3. Runs every suite, restarts the server, then runs each suite's "verify"
//    phase to prove the data persisted.
// 4. Stops the server, prints a summary and deletes the temporary folder.
//
// Options: --keep (keep the temp folder), --update-example (rewrite
// docs/integration-payload.example.json from the real API), E2E_PORT=3999.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL("../../", import.meta.url));
const suitesDir = fileURLToPath(new URL("./", import.meta.url));
const SUITES = ["cv", "jobs", "images", "workflow"];
const port = Number(process.env.E2E_PORT ?? 3999);
const baseUrl = `http://localhost:${port}`;
const keepTemp = process.argv.includes("--keep");
const updateExample = process.argv.includes("--update-example");

if (!existsSync(path.join(projectDir, ".next", "BUILD_ID"))) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

const tempDir = mkdtempSync(path.join(os.tmpdir(), "cv-builder-e2e-"));
const uploadDir = path.join(tempDir, "uploads");
mkdirSync(uploadDir);
const env = {
  ...process.env,
  // Work around prisma/prisma#29355 for the isolated SQLite migration only.
  RUST_LOG: "info",
  DATABASE_URL: `file:${path.join(tempDir, "test.db").replace(/\\/g, "/")}`,
  UPLOAD_DIR: uploadDir,
  E2E_BASE_URL: baseUrl,
  NODE_ENV: "production",
  // Server-only pipeline replacement: no Gemini request or model cost in E2E.
  INTERNAL_E2E_MOCK_AI: "1",
  ...(updateExample ? { E2E_EXAMPLE_OUT: path.join(projectDir, "docs", "integration-payload.example.json") } : {}),
};

console.log(`Test data folder: ${tempDir}`);
const migrate = spawnSync(process.execPath, [path.join(projectDir, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
  cwd: projectDir,
  env,
  encoding: "utf8",
});
if (migrate.status !== 0) {
  console.error("Database migration failed:\n", migrate.stdout, migrate.stderr);
  process.exit(2);
}
console.log("Fresh test database created and migrated.");

let server = null;
const serverLog = path.join(tempDir, "server.log");

async function startServer() {
  const log = openSync(serverLog, "a");
  server = spawn(process.execPath, [path.join(projectDir, "node_modules/next/dist/bin/next"), "start", "-H", "localhost", "-p", String(port)], {
    cwd: projectDir,
    env,
    stdio: ["ignore", log, log],
    detached: process.platform !== "win32",
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited early (code ${server.exitCode}). See ${serverLog}`);
    try {
      if ((await fetch(`${baseUrl}/api/cvs`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready on port ${port}. See ${serverLog}`);
}

/**
 * Stops the server and its child processes, and waits until it has exited so
 * the port is free before the next start. Windows: taskkill on the process
 * tree. macOS/Linux: signal the process group (the server was started
 * detached, so it leads its own group), escalating to SIGKILL if needed.
 */
async function stopServer() {
  const proc = server;
  server = null;
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise((resolve) => proc.once("exit", resolve));
  const waitFor = (ms) => Promise.race([exited.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    await waitFor(10_000);
    return;
  }
  const signalGroup = (signal) => {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      // group already gone
    }
  };
  signalGroup("SIGTERM");
  if (!(await waitFor(10_000))) {
    signalGroup("SIGKILL");
    await waitFor(5_000);
  }
}

/** Runs one suite phase in its own process and tallies its PASS/FAIL lines. */
function runSuite(name, phase, keptData) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(suitesDir, `${name}.suite.mjs`), phase, JSON.stringify(keptData ?? {})], {
      cwd: projectDir,
      env,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d.toString().replace(/^KEEP .*$/m, "").replace(/^(?=.)/gm, "    "));
    });
    child.stderr.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    child.on("close", (code) => {
      const keep = out.match(/^KEEP (.*)$/m);
      resolve({
        name,
        phase,
        passed: (out.match(/^PASS /gm) ?? []).length,
        failed: (out.match(/^FAIL /gm) ?? []).length,
        exitCode: code,
        keep: keep ? JSON.parse(keep[1]) : null,
      });
    });
  });
}

const results = [];
try {
  await startServer();
  console.log(`Server ready at ${baseUrl}\n`);
  const keepBySuite = {};
  for (const name of SUITES) {
    console.log(`▶ ${name} suite`);
    const result = await runSuite(name, "full");
    keepBySuite[name] = result.keep;
    results.push(result);
  }

  console.log("\n↻ Restarting the server to check persistence…");
  await stopServer();
  await startServer();
  for (const name of SUITES) {
    console.log(`▶ ${name} suite (after restart)`);
    results.push(await runSuite(name, "verify", keepBySuite[name]));
  }
} catch (error) {
  console.error(`\n${error.message}`);
  if (existsSync(serverLog)) console.error(readFileSync(serverLog, "utf8").slice(-3000));
  results.push({ name: "runner", phase: "setup", passed: 0, failed: 1, exitCode: 1 });
} finally {
  await stopServer();
}

console.log("\nSummary");
console.log("  suite      phase     passed  failed");
for (const r of results) {
  console.log(`  ${r.name.padEnd(10)} ${r.phase.padEnd(9)} ${String(r.passed).padStart(6)}  ${String(r.failed).padStart(6)}${r.exitCode && !r.failed ? "  (crashed)" : ""}`);
}
const passed = results.reduce((n, r) => n + r.passed, 0);
const failed = results.reduce((n, r) => n + r.failed, 0);
const crashed = results.some((r) => r.exitCode !== 0 && r.failed === 0);
console.log(`  total: ${passed} passed, ${failed} failed${crashed ? ", a suite crashed" : ""}`);

// Give Windows a moment to release file handles before deleting the folder.
await new Promise((resolve) => setTimeout(resolve, 500));
if (keepTemp || failed || crashed) console.log(`Test data kept in ${tempDir}`);
else rmSync(tempDir, { recursive: true, force: true });

process.exitCode = failed || crashed ? 1 : 0;
