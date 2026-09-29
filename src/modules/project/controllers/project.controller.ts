import type { Request, Response } from "express";

import {
  createProject as saveProject,
  listAdminProjects,
  listPublicProjects,
  permanentlyDeleteProject,
  reorderProjects,
  restoreProject,
  softDeleteProject,
  updateProject as saveProjectChanges,
} from "../services/project.service.js";
import { parseProjectPayload } from "../validation/project.validation.js";

export async function getProjects(_req: Request, res: Response): Promise<void> {
  res.json(await listPublicProjects());
}

export async function getAdminProjects(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await listAdminProjects());
}

export async function updateProjectOrder(
  req: Request,
  res: Response,
): Promise<void> {
  const ids: unknown = req.body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length > 500 ||
    !ids.every((id): id is string => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "Provide unique project IDs." });
    return;
  }

  const projects = await reorderProjects(ids);
  if (!projects) {
    res.status(409).json({
      message: "Projects changed. Refresh the page before reordering.",
    });
    return;
  }
  res.json(projects);
}

export async function createProject(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = parseProjectPayload(req.body, false);
  if (!parsed.data) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const project = await saveProject(parsed.data);
  if (!project) {
    res
      .status(409)
      .json({ message: "Could not create a unique project slug." });
    return;
  }
  res.status(201).json(project);
}

export async function updateProject(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = parseProjectPayload(req.body, true);
  if (!parsed.data) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const result = await saveProjectChanges(String(req.params.id), parsed.data);
  if ("slugConflict" in result) {
    res.status(409).json({ message: "That project slug is already in use." });
    return;
  }
  if ("notFound" in result) {
    res.status(404).json({ message: "Project not found." });
    return;
  }
  res.json(result.project);
}

export async function deleteProject(
  req: Request,
  res: Response,
): Promise<void> {
  await softDeleteProject(String(req.params.id));
  res.status(204).end();
}

export async function restoreProjectHandler(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await restoreProject(String(req.params.id)));
}

export async function permanentlyDeleteProjectHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await permanentlyDeleteProject(String(req.params.id));
  res.status(204).end();
}
