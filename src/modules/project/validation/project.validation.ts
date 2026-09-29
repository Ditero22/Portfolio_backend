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

export function parseProjectPayload(value: unknown, partial: boolean): ParsedProject {
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
