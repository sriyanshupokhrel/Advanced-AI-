import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { imageInclude, toImageDto } from "@/lib/db/image-repository";
import { deleteImageFilesBestEffort } from "@/lib/storage/image-storage";
import type {
  AchievementInput,
  CvInput,
  CvProfileDto,
  CvSummaryDto,
  EducationInput,
  ExperienceInput,
  ProjectInput,
  SkillInput,
} from "@/types/cv";

/**
 * All CV database access goes through this module. Every query uses Prisma's
 * parameterised API (no raw SQL), and every child-row write is scoped by
 * cvProfileId so one CV can never modify another CV's items.
 */

/** Thrown when an update refers to an item id that is not part of the CV. */
export class StaleCvItemError extends Error {
  constructor(section: string) {
    super(`An item in "${section}" no longer exists. Reload the CV and try again.`);
  }
}

export const cvInclude = {
  education: { orderBy: { sortOrder: "asc" } },
  experience: { orderBy: { sortOrder: "asc" } },
  skills: { orderBy: { sortOrder: "asc" } },
  projects: { orderBy: { sortOrder: "asc" } },
  achievements: { orderBy: { sortOrder: "asc" } },
  images: { include: imageInclude, orderBy: { createdAt: "asc" } },
} satisfies Prisma.CvProfileInclude;

export type CvWithRelations = Prisma.CvProfileGetPayload<{ include: typeof cvInclude }>;

// ---------------------------------------------------------------------------
// Mapping between validated input ("" = blank) and database rows (NULL = blank)
// ---------------------------------------------------------------------------

const nullIfEmpty = (value: string) => (value === "" ? null : value);
const emptyIfNull = (value: string | null) => value ?? "";

function profileData(input: CvInput) {
  return {
    fullName: input.fullName,
    headline: nullIfEmpty(input.headline),
    email: nullIfEmpty(input.email),
    phone: nullIfEmpty(input.phone),
    location: nullIfEmpty(input.location),
    website: nullIfEmpty(input.website),
    summary: input.summary,
  };
}

const educationData = (item: EducationInput, sortOrder: number) => ({
  institution: item.institution,
  degree: item.degree,
  fieldOfStudy: nullIfEmpty(item.fieldOfStudy),
  startDate: nullIfEmpty(item.startDate),
  endDate: nullIfEmpty(item.endDate),
  grade: nullIfEmpty(item.grade),
  description: nullIfEmpty(item.description),
  sortOrder,
});

const experienceData = (item: ExperienceInput, sortOrder: number) => ({
  employer: item.employer,
  role: item.role,
  location: nullIfEmpty(item.location),
  startDate: item.startDate,
  endDate: item.isCurrent ? null : nullIfEmpty(item.endDate),
  isCurrent: item.isCurrent,
  description: nullIfEmpty(item.description),
  sortOrder,
});

const skillData = (item: SkillInput, sortOrder: number) => ({
  name: item.name,
  category: nullIfEmpty(item.category),
  sortOrder,
});

const projectData = (item: ProjectInput, sortOrder: number) => ({
  name: item.name,
  role: nullIfEmpty(item.role),
  url: nullIfEmpty(item.url),
  technologies: nullIfEmpty(item.technologies),
  description: item.description,
  sortOrder,
});

const achievementData = (item: AchievementInput, sortOrder: number) => ({
  title: item.title,
  issuer: nullIfEmpty(item.issuer),
  date: nullIfEmpty(item.date),
  description: nullIfEmpty(item.description),
  sortOrder,
});

export function toCvDto(cv: CvWithRelations): CvProfileDto {
  return {
    id: cv.id,
    fullName: cv.fullName,
    headline: emptyIfNull(cv.headline),
    email: emptyIfNull(cv.email),
    phone: emptyIfNull(cv.phone),
    location: emptyIfNull(cv.location),
    website: emptyIfNull(cv.website),
    summary: cv.summary,
    createdAt: cv.createdAt.toISOString(),
    updatedAt: cv.updatedAt.toISOString(),
    education: cv.education.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: emptyIfNull(e.fieldOfStudy),
      startDate: emptyIfNull(e.startDate),
      endDate: emptyIfNull(e.endDate),
      grade: emptyIfNull(e.grade),
      description: emptyIfNull(e.description),
    })),
    experience: cv.experience.map((e) => ({
      id: e.id,
      employer: e.employer,
      role: e.role,
      location: emptyIfNull(e.location),
      startDate: e.startDate,
      endDate: emptyIfNull(e.endDate),
      isCurrent: e.isCurrent,
      description: emptyIfNull(e.description),
    })),
    skills: cv.skills.map((s) => ({
      id: s.id,
      name: s.name,
      category: emptyIfNull(s.category),
    })),
    projects: cv.projects.map((p) => ({
      id: p.id,
      name: p.name,
      role: emptyIfNull(p.role),
      url: emptyIfNull(p.url),
      technologies: emptyIfNull(p.technologies),
      description: p.description,
    })),
    achievements: cv.achievements.map((a) => ({
      id: a.id,
      title: a.title,
      issuer: emptyIfNull(a.issuer),
      date: emptyIfNull(a.date),
      description: emptyIfNull(a.description),
    })),
    images: cv.images.map(toImageDto),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listCvSummaries(): Promise<CvSummaryDto[]> {
  const rows = await prisma.cvProfile.findMany({
    select: { id: true, fullName: true, headline: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    headline: emptyIfNull(row.headline),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function cvExists(id: string): Promise<boolean> {
  return (await prisma.cvProfile.count({ where: { id } })) > 0;
}

export async function getCvById(id: string): Promise<CvProfileDto | null> {
  const cv = await prisma.cvProfile.findUnique({ where: { id }, include: cvInclude });
  return cv ? toCvDto(cv) : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createCv(input: CvInput): Promise<CvProfileDto> {
  const cv = await prisma.cvProfile.create({
    data: {
      ...profileData(input),
      education: { create: input.education.map(educationData) },
      experience: { create: input.experience.map(experienceData) },
      skills: { create: input.skills.map(skillData) },
      projects: { create: input.projects.map(projectData) },
      achievements: { create: input.achievements.map(achievementData) },
    },
    include: cvInclude,
  });
  return toCvDto(cv);
}

/**
 * Makes a section's rows match the submitted list: rows whose ids were not
 * submitted are deleted, submitted ids are updated in place, and items without
 * an id are created. Updating in place (rather than delete-all + re-create)
 * keeps ids stable, so images linked to a project stay linked.
 */
async function syncSection<T extends { id?: string }>(
  section: string,
  items: T[],
  ops: {
    deleteExcept: (keepIds: string[]) => Promise<unknown>;
    update: (id: string, item: T, sortOrder: number) => Promise<{ count: number }>;
    create: (item: T, sortOrder: number) => Promise<unknown>;
  },
) {
  const keepIds = items.flatMap((item) => (item.id ? [item.id] : []));
  await ops.deleteExcept(keepIds);
  for (const [sortOrder, item] of items.entries()) {
    if (item.id) {
      const { count } = await ops.update(item.id, item, sortOrder);
      if (count === 0) throw new StaleCvItemError(section);
    } else {
      await ops.create(item, sortOrder);
    }
  }
}

/** Returns null when no CV with this id exists. */
export async function updateCv(id: string, input: CvInput): Promise<CvProfileDto | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cvProfile.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;

    await tx.cvProfile.update({ where: { id }, data: profileData(input) });
    const cvProfileId = id;
    const notIn = (keepIds: string[]) => ({ cvProfileId, id: { notIn: keepIds } });

    await syncSection("education", input.education, {
      deleteExcept: (keep) => tx.education.deleteMany({ where: notIn(keep) }),
      update: (itemId, item, order) =>
        tx.education.updateMany({ where: { id: itemId, cvProfileId }, data: educationData(item, order) }),
      create: (item, order) => tx.education.create({ data: { cvProfileId, ...educationData(item, order) } }),
    });
    await syncSection("experience", input.experience, {
      deleteExcept: (keep) => tx.experience.deleteMany({ where: notIn(keep) }),
      update: (itemId, item, order) =>
        tx.experience.updateMany({ where: { id: itemId, cvProfileId }, data: experienceData(item, order) }),
      create: (item, order) => tx.experience.create({ data: { cvProfileId, ...experienceData(item, order) } }),
    });
    await syncSection("skills", input.skills, {
      deleteExcept: (keep) => tx.skill.deleteMany({ where: notIn(keep) }),
      update: (itemId, item, order) =>
        tx.skill.updateMany({ where: { id: itemId, cvProfileId }, data: skillData(item, order) }),
      create: (item, order) => tx.skill.create({ data: { cvProfileId, ...skillData(item, order) } }),
    });
    await syncSection("projects", input.projects, {
      deleteExcept: (keep) => tx.project.deleteMany({ where: notIn(keep) }),
      update: (itemId, item, order) =>
        tx.project.updateMany({ where: { id: itemId, cvProfileId }, data: projectData(item, order) }),
      create: (item, order) => tx.project.create({ data: { cvProfileId, ...projectData(item, order) } }),
    });
    await syncSection("achievements", input.achievements, {
      deleteExcept: (keep) => tx.achievement.deleteMany({ where: notIn(keep) }),
      update: (itemId, item, order) =>
        tx.achievement.updateMany({ where: { id: itemId, cvProfileId }, data: achievementData(item, order) }),
      create: (item, order) => tx.achievement.create({ data: { cvProfileId, ...achievementData(item, order) } }),
    });

    const updated = await tx.cvProfile.findUniqueOrThrow({ where: { id }, include: cvInclude });
    return toCvDto(updated);
  });
}

/** Deletes the CV, its child rows (cascade) and its image files. */
export async function deleteCv(id: string): Promise<boolean> {
  const images = await prisma.cvImage.findMany({
    where: { cvProfileId: id },
    select: { storedFileName: true },
  });
  const { count } = await prisma.cvProfile.deleteMany({ where: { id } });
  if (count === 0) return false;
  await deleteImageFilesBestEffort(images.map((image) => image.storedFileName));
  return true;
}
