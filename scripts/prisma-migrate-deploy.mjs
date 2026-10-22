import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const prismaCli = path.join(projectDir, "node_modules", "prisma", "build", "index.js");

// Work around prisma/prisma#29355: an inherited RUST_LOG value can make
// SQLite migrate deploy fail with an empty "Schema engine error". Keep the
// override scoped to the Prisma child process and preserve its exit status.
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: projectDir,
  env: { ...process.env, RUST_LOG: "info" },
  stdio: "inherit",
});

if (result.error) {
  console.error("Could not start Prisma migrate deploy:", result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
