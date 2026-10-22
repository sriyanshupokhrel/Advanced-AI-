
import { NextResponse } from "next/server";
import { runInterviewAIPipeline } from "@/lib/ai/ai-pipeline";
import { createPresentationRecord, PresentationSourceChangedError } from "@/lib/db/presentation-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
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

    const { generation, sourceSnapshot } = await runInterviewAIPipeline(id);
    const saved = await createPresentationRecord({
      targetId: id,
      original: generation.presentation,
      imageAnalyses: generation.imageAnalyses,
      sourceSnapshot,
      generatedAt: generation.generatedAt,
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
    console.error("Interview generation failed:", error);

    return NextResponse.json(
      { error: "Unable to generate interview presentation." },
      { status: 500 }
    );
  }
}
