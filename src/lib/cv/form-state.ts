import type {
  AchievementInput,
  CvInput,
  CvProfileDto,
  EducationInput,
  ExperienceInput,
  ProjectInput,
  SkillInput,
} from "@/types/cv";

/**
 * Editor state. Each list item carries a `clientKey` so React can track items
 * that have not been saved yet (and therefore have no database id). The key is
 * stripped before the CV is sent to the API.
 */
export type WithClientKey<T> = T & { clientKey: string };

export type CvListSection = "education" | "experience" | "skills" | "projects" | "achievements";

export interface CvFormState extends Omit<CvInput, CvListSection> {
  education: WithClientKey<EducationInput>[];
  experience: WithClientKey<ExperienceInput>[];
  skills: WithClientKey<SkillInput>[];
  projects: WithClientKey<ProjectInput>[];
  achievements: WithClientKey<AchievementInput>[];
}

const newKey = () => crypto.randomUUID();

export const emptyEducation = (): WithClientKey<EducationInput> => ({
  clientKey: newKey(),
  institution: "",
  degree: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
  grade: "",
  description: "",
});

export const emptyExperience = (): WithClientKey<ExperienceInput> => ({
  clientKey: newKey(),
  employer: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
});

export const emptySkill = (): WithClientKey<SkillInput> => ({
  clientKey: newKey(),
  name: "",
  category: "",
});

export const emptyProject = (): WithClientKey<ProjectInput> => ({
  clientKey: newKey(),
  name: "",
  role: "",
  url: "",
  technologies: "",
  description: "",
});

export const emptyAchievement = (): WithClientKey<AchievementInput> => ({
  clientKey: newKey(),
  title: "",
  issuer: "",
  date: "",
  description: "",
});

export function createEmptyCvForm(): CvFormState {
  return {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    summary: "",
    education: [],
    experience: [],
    skills: [],
    projects: [],
    achievements: [],
  };
}

const withIdAsKey = <T extends { id: string }>(item: T) => ({ ...item, clientKey: item.id });

export function cvToFormState(cv: CvProfileDto): CvFormState {
  return {
    fullName: cv.fullName,
    headline: cv.headline,
    email: cv.email,
    phone: cv.phone,
    location: cv.location,
    website: cv.website,
    summary: cv.summary,
    education: cv.education.map(withIdAsKey),
    experience: cv.experience.map(withIdAsKey),
    skills: cv.skills.map(withIdAsKey),
    projects: cv.projects.map(withIdAsKey),
    achievements: cv.achievements.map(withIdAsKey),
  };
}

const stripKey = <T extends { clientKey: string }>({ clientKey: _key, ...rest }: T) => rest;

/** Converts editor state to the payload accepted by the CV API. */
export function formStateToInput(state: CvFormState): CvInput {
  return {
    ...state,
    education: state.education.map(stripKey),
    experience: state.experience.map(stripKey),
    skills: state.skills.map(stripKey),
    projects: state.projects.map(stripKey),
    achievements: state.achievements.map(stripKey),
  };
}
