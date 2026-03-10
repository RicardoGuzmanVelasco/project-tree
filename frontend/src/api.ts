const API_BASE = "http://localhost:3001";

export async function fetchProjects(): Promise<{slug: string; title: string}[]> {
  const response = await fetch(`${API_BASE}/projects`);
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

export async function deleteTask(slug: string, id: number) {
  const response = await fetch(`${API_BASE}/projects/${slug}/tasks/${id}`, {
    method: "DELETE",
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
