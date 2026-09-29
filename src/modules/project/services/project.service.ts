import prisma from "../../../database/prisma.js";

type ProjectData = Record<string, unknown>;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

async function availableSlug(
  base: string,
  excludeId?: string,
  addSuffixOnConflict = false,
) {
  const normalizedBase = slugify(base) || "project";
  for (let suffix = 1; suffix <= (addSuffixOnConflict ? 100 : 1); suffix += 1) {
    const candidate =
      suffix === 1 ? normalizedBase : `${normalizedBase}-${suffix}`;
    const existing = await prisma.project.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    } as never);
    if (!existing) return candidate;
  }
  return null;
}

export function listPublicProjects() {
  return prisma.project.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export function listAdminProjects() {
  return prisma.project.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function reorderProjects(ids: string[]) {
  return prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const requested = new Set(ids);
    if (
      projects.length !== ids.length ||
      projects.some((project) => !requested.has(project.id))
    ) {
      return null;
    }

    for (const [sortOrder, id] of ids.entries()) {
      await tx.project.update({ where: { id }, data: { sortOrder } });
    }

    return tx.project.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  });
}

export async function createProject(data: ProjectData) {
  const explicitSlug = typeof data.slug === "string";
  const slug = await availableSlug(
    explicitSlug ? String(data.slug) : String(data.title ?? "project"),
    undefined,
    !explicitSlug,
  );
  if (!slug) return null;

  const currentOrder = await prisma.project.aggregate({
    where: { deletedAt: null },
    _max: { sortOrder: true },
  });

  return prisma.project.create({
    data: {
      ...data,
      slug,
      sortOrder: (currentOrder._max.sortOrder ?? -1) + 1,
    } as never,
  });
}

type UpdateProjectResult =
  | { project: Awaited<ReturnType<typeof prisma.project.update>> }
  | { slugConflict: true }
  | { notFound: true };

function isMissingProject(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

export async function updateProject(
  id: string,
  data: ProjectData,
): Promise<UpdateProjectResult> {
  if (typeof data.slug === "string") {
    const slug = await availableSlug(data.slug, id);
    if (!slug) return { slugConflict: true };
    data.slug = slug;
  }

  try {
    return {
      project: await prisma.project.update({
        where: { id },
        data: data as never,
      }),
    };
  } catch (error) {
    if (isMissingProject(error)) return { notFound: true };
    throw error;
  }
}

export function softDeleteProject(id: string) {
  return prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export function restoreProject(id: string) {
  return prisma.project.update({ where: { id }, data: { deletedAt: null } });
}

export function permanentlyDeleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}
