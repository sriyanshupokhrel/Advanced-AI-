
import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { PayloadImage } from "@/types/integration";

export interface ImageAnalysisResult {
  imageId: string;
  projectName: string;
  visibleFeatures: string[];
  relevantSkills: string[];
  presentationCaption: string;
  limitations: string[];
}

export interface ImageAnalysisInput {
  image: PayloadImage;
  imageBytes: Uint8Array;
  projectName: string;
  projectDescription: string;
  jobDescription: string;
}

export async function analyseProjectImage(
  input: ImageAnalysisInput
): Promise<ImageAnalysisResult> {
  if (!input.image.confirmation.isConfirmed) {
    throw new Error("Image must be confirmed before analysis.");
  }

  if (!input.image.fileAvailable) {
    throw new Error("Image file is unavailable.");
  }

  if (!input.image.mimeType.startsWith("image/")) {
    throw new Error("Unsupported image type.");
  }

  if (input.imageBytes.length === 0) {
    throw new Error("Image data is empty.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are analysing a user-uploaded project screenshot
for a job-tailored interview presentation.

PROJECT NAME:
${input.projectName}

USER-PROVIDED PROJECT DESCRIPTION:
${input.projectDescription}

TARGET JOB DESCRIPTION:
${input.jobDescription}

Analyse the actual image carefully.

Return ONLY a valid JSON object with these fields:
{
  "visibleFeatures": ["feature"],
  "relevantSkills": ["skill"],
  "presentationCaption": "short caption",
  "limitations": ["limitation"]
}

Rules:
- Only describe image features that are visibly supported.
- Treat project descriptions as user-provided context, not proof.
- Do not invent technologies, achievements, or performance metrics.
- Do not claim that the image proves project ownership.
- Relevant skills are suggestions, not verified qualifications.
- Use concise, professional language.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: input.image.mimeType,
              data: Buffer.from(input.imageBytes).toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed: unknown = JSON.parse(response.text);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("visibleFeatures" in parsed) ||
    !("relevantSkills" in parsed) ||
    !("presentationCaption" in parsed) ||
    !("limitations" in parsed)
  ) {
    throw new Error("Invalid Gemini image analysis response.");
  }

  const result = parsed as Omit<
    ImageAnalysisResult,
    "imageId" | "projectName"
  >;

  if (
    !Array.isArray(result.visibleFeatures) ||
    !result.visibleFeatures.every(x => typeof x === "string") ||
    !Array.isArray(result.relevantSkills) ||
    !result.relevantSkills.every(x => typeof x === "string") ||
    typeof result.presentationCaption !== "string" ||
    !Array.isArray(result.limitations) ||
    !result.limitations.every(x => typeof x === "string")
  ) {
    throw new Error("Gemini returned invalid field types.");
  }

  return {
    imageId: input.image.imageId,
    projectName: input.projectName,
    ...result,
  };
}
