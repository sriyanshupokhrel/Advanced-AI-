export class PipelineError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.name = "PipelineError"; this.status = status; this.code = code;
  }
}
export function safePipelineError(error: unknown) {
  if (error instanceof PipelineError) {
    console.error("Interview request rejected",{code:error.code,status:error.status});
    return error;
  }
  // Do not log provider error bodies, prompts, URLs or credentials.
  console.error("Interview pipeline failed", { type: error instanceof Error ? error.name : "Unknown" });
  return new PipelineError(500, "INTERNAL", "Interview processing failed. Please reload and try again.");
}
