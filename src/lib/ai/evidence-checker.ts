
import type {
  InterviewPreparationPayload,
} from "@/types/integration";

export type EvidenceSourceType =
  | "profile"
  | "education"
  | "experience"
  | "skill"
  | "project"
  | "achievement";

export interface EvidenceClaim {
  text: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  supportingText: string;
}

export interface EvidenceCheckResult {
  claim: string;
  status: "EXCERPT_FOUND_REVIEW_REQUIRED" | "NEEDS_REVIEW";
  sourceId: string;
  explanation: string;
}

function getSourceText(
  payload: InterviewPreparationPayload,
  type: EvidenceSourceType,
  id: string
): string | null {
  const c = payload.candidate;

  switch (type) {
    case "profile":
      return id === c.cvProfileId
        ? [c.profile.headline, c.profile.professionalSummary]
            .filter(Boolean).join(" ")
        : null;

    case "education": {
      const item = c.education.items.find(x => x.id === id);
      return item
        ? [item.qualification, item.institution,
           item.fieldOfStudy, item.grade, item.description]
            .filter(Boolean).join(" ")
        : null;
    }

    case "experience": {
      const item = c.workExperience.items.find(x => x.id === id);
      return item
        ? [item.jobTitle, item.employer, item.description]
            .filter(Boolean).join(" ")
        : null;
    }

    case "skill": {
      const item = c.skills.items.find(x => x.id === id);
      return item ? item.name : null;
    }

    case "project": {
      const item = c.projects.items.find(x => x.id === id);
      return item
        ? [item.name, item.role, item.technologies, item.description]
            .filter(Boolean).join(" ")
        : null;
    }

    case "achievement": {
      const item = c.achievements.items.find(x => x.id === id);
      return item
        ? [item.title, item.issuer, item.description]
            .filter(Boolean).join(" ")
        : null;
    }
  }
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function checkEvidence(
  payload: InterviewPreparationPayload,
  claims: EvidenceClaim[]
): EvidenceCheckResult[] {
  if (
    payload.contractVersion !== "2.0" ||
    !payload.readiness.isReady ||
    payload.readiness.status !== "READY"
  ) {
    throw new Error("Confirmed CV and job data required.");
  }

  return claims.map(claim => {
    const source = getSourceText(
      payload,
      claim.sourceType,
      claim.sourceId
    );

    if (!source) {
      return {
        claim: claim.text,
        status: "NEEDS_REVIEW" as const,
        sourceId: claim.sourceId,
        explanation: "The referenced CV source was not found.",
      };
    }

    const excerpt = normalise(claim.supportingText);
    const original = normalise(source);

    if (!excerpt || !original.includes(excerpt)) {
      return {
        claim: claim.text,
        status: "NEEDS_REVIEW" as const,
        sourceId: claim.sourceId,
        explanation:
          "The cited supporting text does not match the CV source.",
      };
    }

    return {
      claim: claim.text,
      status: "EXCERPT_FOUND_REVIEW_REQUIRED" as const,
      sourceId: claim.sourceId,
      explanation:
        "The cited excerpt exists in the user-confirmed CV. " +
        "The claim itself still requires semantic verification.",
    };
  });
}
