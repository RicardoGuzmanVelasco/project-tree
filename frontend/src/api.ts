const API_BASE = "http://localhost:3001";

export async function fetchTree() {
  const response = await fetch(`${API_BASE}/tasks`);
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

export async function relocateTask(id: number, newParentId: number) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: newParentId }),
  });
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
