import { Router } from "express";
import prisma from "../../../database/prisma.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";

const router = Router();
const projectCategories = new Set([
  "web",
  "mobile",
  "networking",
  "software",
  "other",
]);
const projectStatuses = new Set(["completed", "in-progress", "planned"]);
const projectContributionKinds = new Set([
  "built",
  "designed",
  "supported",
  "team",
]);
const textLimits = {
  title: 160,
  role: 120,
  description: 2_000,
  fullDescription: 12_000,
  slug: 100,
};
const arrayLimits = {
  stack: { count: 40, text: 120 },
  highlights: { count: 40, text: 500 },
  images: { count: 12, text: 2_000 },
};

type ProjectPayload = Record<string, unknown>;
type ParsedProject = {
  data?: Record<string, unknown>;
  error?: string;
};

function isRecord(value: unknown): value is ProjectPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, textLimits.slug)
    .replace(/-+$/g, "");
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseProjectPayload(value: unknown, partial: boolean): ParsedProject {
  if (!isRecord(value)) return { error: "Provide project details." };
  const data: Record<string, unknown> = {};
  const requiredText = (field: "title" | "role" | "description") => {
    const input = value[field];
    if (input === undefined && partial) return;
    if (
      typeof input !== "string" ||
      !input.trim() ||
      input.trim().length > textLimits[field]
    ) {
      throw new Error(
        `Enter a project ${field} with no more than ${textLimits[field]} characters.`,
      );
    }
    data[field] = input.trim();
  };

  try {
    requiredText("title");
    requiredText("role");
    requiredText("description");

    if (value.slug !== undefined) {
      if (typeof value.slug !== "string")
        throw new Error("Project slug must be text.");
      const slug = slugify(value.slug);
      if (value.slug.trim() && !slug)
        throw new Error("Enter a slug using letters and numbers.");
      if (slug) data.slug = slug;
    }

    if (value.category !== undefined || !partial) {
      const category =
        value.category === undefined
          ? "web"
          : typeof value.category === "string"
            ? value.category.trim().toLowerCase()
            : "";
      if (!projectCategories.has(category)) {
        throw new Error(
          "Choose a supported project category: web, mobile, networking, software, or other.",
        );
      }
      data.category = category;
    }

    if (value.fullDescription !== undefined || !partial) {
      const fullDescription = value.fullDescription ?? "";
      if (
        typeof fullDescription !== "string" ||
        fullDescription.trim().length > textLimits.fullDescription
      ) {
        throw new Error(
          `Full description must be no longer than ${textLimits.fullDescription} characters.`,
        );
      }
      data.fullDescription = fullDescription.trim() || null;
    }

    for (const field of ["stack", "highlights", "images"] as const) {
      if (value[field] === undefined && partial) continue;
      const input = value[field] ?? [];
      const limits = arrayLimits[field];
      if (
        !Array.isArray(input) ||
        input.length > limits.count ||
        !input.every(
          (item) =>
            typeof item === "string" && item.trim().length <= limits.text,
        )
      ) {
        throw new Error(
          `${field} must contain up to ${limits.count} text entries of ${limits.text} characters or fewer.`,
        );
      }
      const items = [
        ...new Set(input.map((item) => item.trim()).filter(Boolean)),
      ];
      if (field === "images" && items.some((image) => !validHttpUrl(image))) {
        throw new Error("Project images must use HTTP or HTTPS URLs.");
      }
      data[field] = items;
    }

    if (value.contributions !== undefined || !partial) {
      const input = value.contributions ?? [];
      if (!Array.isArray(input) || input.length > 40) {
        throw new Error("Add up to 40 project contribution details.");
      }

      data.contributions = input.map((item) => {
        if (!isRecord(item)) {
          throw new Error("Each project contribution must be an object.");
        }

        const kind =
          typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
        const title = typeof item.title === "string" ? item.title.trim() : "";
        const details =
          item.details === undefined || item.details === null
            ? ""
            : typeof item.details === "string"
              ? item.details.trim()
              : null;

        if (!projectContributionKinds.has(kind)) {
          throw new Error(
            "Choose built, designed, supported, or team for each contribution.",
          );
        }
        if (!title || title.length > 160) {
          throw new Error(
            "Each contribution needs a title with no more than 160 characters.",
          );
        }
        if (details === null || details.length > 500) {
          throw new Error(
            "Contribution details must be text with no more than 500 characters.",
          );
        }

        return {
          kind,
          title,
          ...(details ? { details } : {}),
        };
      });
    }

    for (const field of ["coverImageUrl", "sourceUrl", "liveUrl"] as const) {
      if (value[field] === undefined && partial) continue;
      const input = value[field] ?? "";
      if (typeof input !== "string" || input.trim().length > 2_000) {
        throw new Error(`${field} must be a valid HTTP or HTTPS URL.`);
      }
      const url = input.trim();
      if (url && !validHttpUrl(url)) {
        throw new Error(`${field} must be a valid HTTP or HTTPS URL.`);
      }
      data[field] = url || null;
    }

    if (value.status !== undefined || !partial) {
      const status =
        value.status === undefined
          ? "completed"
          : typeof value.status === "string"
            ? value.status.trim().toLowerCase()
            : "";
      if (!projectStatuses.has(status)) {
        throw new Error("Choose completed, in-progress, or planned status.");
      }
      data.status = status;
    }

    for (const field of ["featured", "published"] as const) {
      if (value[field] === undefined && partial) continue;
      const input =
        value[field] === undefined ? field === "published" : value[field];
      if (typeof input !== "boolean") {
        throw new Error(`${field} must be true or false.`);
      }
      data[field] = input;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Invalid project details.",
    };
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "Provide at least one project field to update." };
  }
  return { data };
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

router.get("/projects", async (_req, res) =>
  res.json(
    await prisma.project.findMany({
      where: { published: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ),
);

router.get("/admin/projects", requireAuth, async (_req, res) =>
  res.json(
    await prisma.project.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ),
);

router.patch("/admin/projects/order", requireAuth, async (req, res) => {
  const ids: unknown = req.body?.ids;
  if (
    !Array.isArray(ids) ||
    !ids.every((id): id is string => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "Provide unique project IDs." });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const requested = new Set(ids);
    if (
      projects.length !== ids.length ||
      projects.some((project) => !requested.has(project.id))
    )
      return null;
    for (const [sortOrder, id] of ids.entries()) {
      await tx.project.update({ where: { id }, data: { sortOrder } });
    }
    return tx.project.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  });
  if (!result) {
    res.status(409).json({
      message: "Projects changed. Refresh the page before reordering.",
    });
    return;
  }
  res.json(result);
});

router.post("/projects", requireAuth, async (req, res) => {
  const parsed = parseProjectPayload(req.body, false);
  if (!parsed.data) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const explicitSlug = typeof parsed.data.slug === "string";
  const slug = await availableSlug(
    explicitSlug
      ? String(parsed.data.slug)
      : String(parsed.data.title ?? "project"),
    undefined,
    !explicitSlug,
  );
  if (!slug) {
    res
      .status(409)
      .json({ message: "Could not create a unique project slug." });
    return;
  }
  parsed.data.slug = slug;
  const currentOrder = await prisma.project.aggregate({
    where: { deletedAt: null },
    _max: { sortOrder: true },
  });
  parsed.data.sortOrder = (currentOrder._max.sortOrder ?? -1) + 1;
  res
    .status(201)
    .json(await prisma.project.create({ data: parsed.data as never }));
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  const parsed = parseProjectPayload(req.body, true);
  if (!parsed.data) {
    res.status(400).json({ message: parsed.error });
    return;
  }
  const id = String(req.params.id);
  if (typeof parsed.data.slug === "string") {
    const slug = await availableSlug(parsed.data.slug, id);
    if (!slug) {
      res.status(409).json({ message: "That project slug is already in use." });
      return;
    }
    parsed.data.slug = slug;
  }
  try {
    res.json(
      await prisma.project.update({
        where: { id },
        data: parsed.data as never,
      }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      res.status(404).json({ message: "Project not found." });
      return;
    }
    throw error;
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  await prisma.project.update({
    where: { id: String(req.params.id) },
    data: { deletedAt: new Date() },
  });
  res.status(204).end();
});

router.post("/projects/:id/restore", requireAuth, async (req, res) =>
  res.json(
    await prisma.project.update({
      where: { id: String(req.params.id) },
      data: { deletedAt: null },
    }),
  ),
);

router.delete("/projects/:id/permanent", requireAuth, async (req, res) => {
  await prisma.project.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

export default router;
