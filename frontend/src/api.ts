const API_BASE = "http://localhost:3001";

export async function fetchTree() {
  const response = await fetch(`${API_BASE}/tasks`);
  return response.json();
}
