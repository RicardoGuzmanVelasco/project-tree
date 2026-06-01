const PREFIX = "pt-view";

function globalKey(field: string): string {
  return `${PREFIX}:${field}`;
}

export function saveGlobal(field: string, value: unknown) {
  localStorage.setItem(globalKey(field), JSON.stringify(value));
}

export function loadGlobal<T>(field: string, fallback: T): T {
  const raw = localStorage.getItem(globalKey(field));
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
