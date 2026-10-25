
import { NextResponse } from "next/server";
import { runInterviewAIPipeline } from "@/lib/ai/ai-pipeline";
import { createPresentationRecord, PresentationSourceChangedError } from "@/lib/db/presentation-repository";
import { safePipelineError } from "@/lib/ai/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Target ID is required." },
        { status: 400 }
      );
    }

    let expectedSourceFingerprint: string | undefined;
    if (request.headers.get("content-type")?.includes("application/json")) {
      let body: unknown;
      try { body = await request.json(); } catch {
        return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
      }
      if (!body || typeof body !== "object" || !("expectedSourceFingerprint" in body) ||
          typeof body.expectedSourceFingerprint !== "string" || body.expectedSourceFingerprint.length > 50_000) {
        return NextResponse.json({ error: "A valid expectedSourceFingerprint is required." }, { status: 400 });
      }
      expectedSourceFingerprint = body.expectedSourceFingerprint;
    }
    const { generation, sourceSnapshot } = await runInterviewAIPipeline(id, expectedSourceFingerprint);
    const saved = await createPresentationRecord({
      targetId: id,
      original: generation.presentation,
      imageAnalyses: generation.imageAnalyses,
      sourceSnapshot,
      generatedAt: generation.generatedAt,
      reliability: "reliability" in generation ? generation.reliability : null,
    });

    return NextResponse.json({
      ...generation,
      presentationId: saved.id,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    if (error instanceof PresentationSourceChangedError) {
      return NextResponse.json(
        { error: "The confirmed CV, job or images changed during generation. The result was not saved." },
        { status: 409 },
      );
    }
    const safe = safePipelineError(error);
    return NextResponse.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
}
