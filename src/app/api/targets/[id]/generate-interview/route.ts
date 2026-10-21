
import { NextResponse } from "next/server";
import { runInterviewAIPipeline } from "@/lib/ai/ai-pipeline";

export const runtime = "nodejs";

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

    const result = await runInterviewAIPipeline(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Interview generation failed:", error);

    return NextResponse.json(
      { error: "Unable to generate interview presentation." },
      { status: 500 }
    );
  }
}
