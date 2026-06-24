import fs from "fs";
import path from "path";
import { Task } from "./types";
import { ensureCompleted } from "./tree-ops";

const SUBDIR = "pruned";

function prunedDir(dataDir: string): string {
  return path.join(dataDir, SUBDIR);
}

function prunedFile(dataDir: string, parentId: number): string {
  return path.join(prunedDir(dataDir), `${parentId}.json`);
}

export function readPrunedForest(dataDir: string, parentId: number): Task[] | null {
  const file = prunedFile(dataDir, parentId);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Task[];
  return raw.map(ensureCompleted);
}

export function appendPrunedForest(dataDir: string, parentId: number, subtrees: Task[]): void {
  if (subtrees.length === 0) return;
  const dir = prunedDir(dataDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = readPrunedForest(dataDir, parentId) ?? [];
  const next = existing.concat(subtrees);
  fs.writeFileSync(prunedFile(dataDir, parentId), JSON.stringify(next, null, 2) + "\n");
}

export function listPrunedIds(dataDir: string): Set<number> {
  const dir = prunedDir(dataDir);
  if (!fs.existsSync(dir)) return new Set();
  const ids = new Set<number>();
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(/^(\d+)\.json$/);
    if (m) ids.add(parseInt(m[1], 10));
  }
  return ids;
}
