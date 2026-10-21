
import type {
  InterviewPreparationPayload,
} from "@/types/integration";

export interface SelectedEvidence {
  sourceId: string;
  sourceType: "skill" | "experience" | "project" | "education";
  title: string;
  description: string;
  relevanceScore: number;
  imageIds: string[];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that",
  "this", "you", "will", "your", "are", "our",
  "have", "about", "work", "role", "join",
  "into", "used", "using",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .match(/[a-z0-9+#.]+/g)
      ?.filter(word => word.length > 2 && !STOP_WORDS.has(word))
      ?? []
  );
}

function relevance(text: string, jobText: string): number {
  const terms = keywords(text);
  const jobTerms = keywords(jobText);

  if (terms.size === 0 || jobTerms.size === 0) return 0;

  const matches = [...terms].filter(term => jobTerms.has(term));

  return Math.round((matches.length / terms.size) * 100);
}

export function selectRelevantEvidence(
  payload: InterviewPreparationPayload,
  limit = 8
): SelectedEvidence[] {
  if (
    payload.contractVersion !== "2.0" ||
    !payload.readiness.isReady ||
    payload.readiness.status !== "READY"
  ) {
    throw new Error("CV and job must be confirmed before AI processing.");
  }

  const jobText = [
    payload.targetJob.jobTitle ?? "",
    payload.targetJob.descriptionText,
  ].join(" ");

  const results: SelectedEvidence[] = [];

  for (const skill of payload.candidate.skills.items) {
    results.push({
      sourceId: skill.id,
      sourceType: "skill",
      title: skill.name,
      description: skill.category ?? "",
      relevanceScore: relevance(skill.name, jobText),
      imageIds: [],
    });
  }

  for (const exp of payload.candidate.workExperience.items) {
    results.push({
      sourceId: exp.id,
      sourceType: "experience",
      title: `${exp.jobTitle} at ${exp.employer}`,
      description: exp.description ?? "",
      relevanceScore: relevance(
        `${exp.jobTitle} ${exp.description ?? ""}`,
        jobText
      ),
      imageIds: [],
    });
  }

  for (const project of payload.candidate.projects.items) {
    results.push({
      sourceId: project.id,
      sourceType: "project",
      title: project.name,
      description: project.description,
      relevanceScore: relevance(
        `${project.name} ${project.technologies ?? ""} ${project.description}`,
        jobText
      ),
      imageIds: project.images.map(image => image.imageId),
    });
  }

  for (const education of payload.candidate.education.items) {
    results.push({
      sourceId: education.id,
      sourceType: "education",
      title: education.qualification,
      description: `${education.institution} ${education.fieldOfStudy ?? ""}`,
      relevanceScore: relevance(
        `${education.qualification} ${education.fieldOfStudy ?? ""}`,
        jobText
      ),
      imageIds: [],
    });
  }

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, Math.max(0, limit));
}
