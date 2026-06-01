import { Plan } from "./types";

const API_BASE = "";

export async function fetchTree() {
  const response = await fetch(`${API_BASE}/tasks`);
  return response.json();
}

export async function createTask(parentId: number, title: string) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, title }),
  });
  return response.json();
}

export async function toggleTaskCompletion(id: number, completed: boolean) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  return response.json();
}

export async function toggleTaskAbandoned(id: number, abandoned: boolean) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ abandoned }),
  });
  return response.json();
}

export async function relocateTask(id: number, newParentId: number) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: newParentId }),
  });
  return response.json();
}

export async function renameTask(id: number, title: string) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return response.json();
}

export async function deleteTask(id: number) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
  });
  return response.json();
}

export async function updateDescription(id: number, description: string) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  return response.json();
}

export async function pruneTask(id: number): Promise<{ task: unknown; prunedCount: number }> {
  const response = await fetch(`${API_BASE}/tasks/${id}/prune`, {
    method: "POST",
  });
  return response.json();
}

export async function fetchPlans(): Promise<Plan[]> {
  const response = await fetch(`${API_BASE}/plans`);
  return response.json();
}

export async function fetchPlan(planId: number): Promise<Plan> {
  const response = await fetch(`${API_BASE}/plans/${planId}`);
  return response.json();
}

export async function createPlan(name: string): Promise<Plan> {
  const response = await fetch(`${API_BASE}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, taskIds: [] }),
  });
  return response.json();
}

export async function updatePlan(planId: number, taskIds: number[], archived?: boolean): Promise<Plan> {
  const body: Record<string, unknown> = { taskIds };
  if (archived !== undefined) body.archived = archived;
  const response = await fetch(`${API_BASE}/plans/${planId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}
