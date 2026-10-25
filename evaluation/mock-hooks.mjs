// Test-process-only substitution. Never loaded by the application.
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
  if (specifier === '@google/genai') return { url: new URL('./mock-genai.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
