const API_BASE = "http://localhost:3001";

export async function fetchProjects(): Promise<{slug: string; title: string}[]> {
  const response = await fetch(`${API_BASE}/projects`);
  return response.json();
}

export async function createProject(name: string): Promise<{slug: string; title: string}> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to create project");
  }
  return response.json();
}

export async function fetchTree(slug: string) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks`);
  return response.json();
}

export async function toggleTaskCompletion(slug: string, id: number, completed: boolean) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  return response.json();
}

export async function relocateTask(slug: string, id: number, newParentId: number) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: newParentId }),
  });
  return response.json();
}

export async function renameTask(slug: string, id: number, title: string) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return response.json();
}

export async function deleteTask(slug: string, id: number) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "DELETE",
  });
  return response.json();
}

export async function updateDescription(slug: string, id: number, description: string) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  return response.json();
}

import { Plan } from "./types";

export async function fetchPlans(slug: string): Promise<Plan[]> {
  const response = await fetch(`${API_BASE}/projects/${slug}/plans`);
  return response.json();
}

export async function fetchPlan(slug: string, planId: number): Promise<Plan> {
  const response = await fetch(`${API_BASE}/projects/${slug}/plans/${planId}`);
  return response.json();
}

export async function createPlan(slug: string, name: string): Promise<Plan> {
  const response = await fetch(`${API_BASE}/projects/${slug}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, taskIds: [] }),
  });
  return response.json();
}

export async function updatePlan(slug: string, planId: number, taskIds: number[], archived?: boolean): Promise<Plan> {
  const body: Record<string, unknown> = { taskIds };
  if (archived !== undefined) body.archived = archived;
  const response = await fetch(`${API_BASE}/projects/${slug}/plans/${planId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function toggleTaskAbandoned(slug: string, id: number, abandoned: boolean) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ abandoned }),
  });
  return response.json();
}

export async function createTask(slug: string, parentId: number, title: string) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, title }),
  });
  return response.json();
}
