// Module-resolution hooks so Node can run the app's TypeScript sources in unit
// tests without a bundler: maps "@/x" to "src/x" and adds the missing ".ts"
// extension to relative imports (the app is written for Next.js's resolver).
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return {url:"data:text/javascript,export {}",shortCircuit:true};
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = path.join(SRC, specifier.slice(2));
  } else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:") && !path.extname(specifier)) {
    candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (candidate) {
    for (const suffix of [".ts", "/index.ts"]) {
      if (existsSync(candidate + suffix)) return nextResolve(pathToFileURL(candidate + suffix).href, context);
    }
  }
  return nextResolve(specifier, context);
}
