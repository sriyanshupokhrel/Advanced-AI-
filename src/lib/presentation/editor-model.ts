import type { InterviewPreparationPayload, PayloadImage } from "@/types/integration";
import type { InterviewPresentation, PresentationSlide } from "@/types/presentation";

export interface DraftValidationIssue {
  path: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

export interface ResolvedEvidenceSource {
  id: string;
  type: "skill" | "experience" | "project" | "education";
  title: string;
  description: string;
}

export interface ResolvedImageSource {
  imageId: string;
  projectName: string;
  image: PayloadImage;
}

export type ReferenceResult<T> =
  | { id: string; status: "FOUND"; value: T }
  | { id: string; status: "MISSING" };

export interface ResolvedSlideReferences {
  sources: ReferenceResult<ResolvedEvidenceSource>[];
  images: ReferenceResult<ResolvedImageSource>[];
}

/** Make every editable nested array independent from the immutable original. */
export function clonePresentation(presentation: InterviewPresentation): InterviewPresentation {
  return {
    title: presentation.title,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      bullets: [...slide.bullets],
      sourceIds: [...slide.sourceIds],
      imageIds: [...slide.imageIds],
    })),
  };
}

export const presentationsEqual = (a: InterviewPresentation, b: InterviewPresentation) =>
  JSON.stringify(a) === JSON.stringify(b);

export const hasNewerEditsThanSubmittedSave = (
  currentDraft: InterviewPresentation,
  submittedDraft: InterviewPresentation,
) => !presentationsEqual(currentDraft, submittedDraft);

/** Draft saves may change wording only, never the evidence/image layout. */
export function hasSamePresentationReferences(original: InterviewPresentation, draft: InterviewPresentation) {
  return original.slides.length === draft.slides.length && original.slides.every((slide, index) => {
    const edited = draft.slides[index];
    return Boolean(edited &&
      slide.bullets.length === edited.bullets.length &&
      JSON.stringify(slide.sourceIds) === JSON.stringify(edited.sourceIds) &&
      JSON.stringify(slide.imageIds) === JSON.stringify(edited.imageIds));
  });
}

export function updatePresentationTitle(draft: InterviewPresentation, title: string): InterviewPresentation {
  return { ...draft, title };
}

export function updateSlide(
  draft: InterviewPresentation,
  slideIndex: number,
  changes: Partial<Pick<PresentationSlide, "heading" | "speakerNotes">>,
): InterviewPresentation {
  return {
    ...draft,
    slides: draft.slides.map((slide, index) => (index === slideIndex ? { ...slide, ...changes } : slide)),
  };
}

export function updateBullet(
  draft: InterviewPresentation,
  slideIndex: number,
  bulletIndex: number,
  value: string,
): InterviewPresentation {
  return {
    ...draft,
    slides: draft.slides.map((slide, index) =>
      index === slideIndex
        ? { ...slide, bullets: slide.bullets.map((bullet, i) => (i === bulletIndex ? value : bullet)) }
        : slide,
    ),
  };
}

export function validatePresentationDraft(draft: InterviewPresentation): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  if (!draft.title.trim()) issues.push({ path: "title", severity: "ERROR", message: "Presentation title is required." });
  if (draft.slides.length < 4 || draft.slides.length > 5) {
    issues.push({ path: "slides", severity: "ERROR", message: "A presentation must contain 4 or 5 slides." });
  }
  draft.slides.forEach((slide, slideIndex) => {
    if (!slide.heading.trim()) {
      issues.push({ path: `slides.${slideIndex}.heading`, severity: "ERROR", message: "Slide heading is required." });
    }
    if (slide.bullets.length < 1 || slide.bullets.length > 5) {
      issues.push({ path: `slides.${slideIndex}.bullets`, severity: "ERROR", message: "Each slide needs 1 to 5 bullets." });
    }
    slide.bullets.forEach((bullet, bulletIndex) => {
      if (!bullet.trim()) {
        issues.push({
          path: `slides.${slideIndex}.bullets.${bulletIndex}`,
          severity: "ERROR",
          message: "Bullet text is temporarily empty.",
        });
      }
    });
  });
  return issues;
}

export function getSlideFitWarnings(slide: PresentationSlide): string[] {
  const warnings: string[] = [];
  const totalBulletCharacters = slide.bullets.reduce((total, bullet) => total + bullet.length, 0);
  if (slide.heading.length > 80) warnings.push("The heading is long and may wrap across several lines.");
  if (slide.bullets.length === 5 && totalBulletCharacters > 300) {
    warnings.push("This slide has dense body content. Shorten it before final delivery.");
  }
  if (slide.bullets.some((bullet) => bullet.length > 150)) {
    warnings.push("At least one bullet is very long and may be difficult to read on a projected slide.");
  }
  return warnings;
}

export function buildEvidenceMap(payload: InterviewPreparationPayload): Map<string, ResolvedEvidenceSource> {
  const sources: ResolvedEvidenceSource[] = [
    ...payload.candidate.skills.items.map((item) => ({
      id: item.id,
      type: "skill" as const,
      title: item.name,
      description: item.category ?? "No category provided",
    })),
    ...payload.candidate.workExperience.items.map((item) => ({
      id: item.id,
      type: "experience" as const,
      title: `${item.jobTitle} at ${item.employer}`,
      description: item.description ?? "No description provided",
    })),
    ...payload.candidate.projects.items.map((item) => ({
      id: item.id,
      type: "project" as const,
      title: item.name,
      description: item.description,
    })),
    ...payload.candidate.education.items.map((item) => ({
      id: item.id,
      type: "education" as const,
      title: item.qualification,
      description: `${item.institution}${item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ""}`,
    })),
  ];
  return new Map(sources.map((source) => [source.id, source]));
}

export function buildImageMap(payload: InterviewPreparationPayload): Map<string, ResolvedImageSource> {
  const images: ResolvedImageSource[] = payload.candidate.projects.items.flatMap((project) =>
    project.images.map((image) => ({ imageId: image.imageId, projectName: project.name, image })),
  );
  return new Map(images.map((image) => [image.imageId, image]));
}

export function resolveSlideReferences(
  slide: PresentationSlide,
  payload: InterviewPreparationPayload,
): ResolvedSlideReferences {
  const evidence = buildEvidenceMap(payload);
  const images = buildImageMap(payload);
  return {
    sources: slide.sourceIds.map((id) => {
      const value = evidence.get(id);
      return value ? { id, status: "FOUND" as const, value } : { id, status: "MISSING" as const };
    }),
    images: slide.imageIds.map((id) => {
      const value = images.get(id);
      return value ? { id, status: "FOUND" as const, value } : { id, status: "MISSING" as const };
    }),
  };
}
