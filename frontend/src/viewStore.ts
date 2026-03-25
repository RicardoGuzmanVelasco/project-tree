const PREFIX = "pt-view";

function key(slug: string, field: string): string {
  return `${PREFIX}:${slug}:${field}`;
}

function globalKey(field: string): string {
  return `${PREFIX}:${field}`;
}

export function saveField(slug: string, field: string, value: unknown) {
  localStorage.setItem(key(slug, field), JSON.stringify(value));
}

export function loadField<T>(slug: string, field: string, fallback: T): T {
  const raw = localStorage.getItem(key(slug, field));
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function saveGlobal(field: string, value: unknown) {
  localStorage.setItem(globalKey(field), JSON.stringify(value));
}

export function loadGlobal<T>(field: string, fallback: T): T {
  const raw = localStorage.getItem(globalKey(field));
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
