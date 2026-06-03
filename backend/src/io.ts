import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";
import { ensureCompleted } from "./tree-ops";

// --- Tree I/O ---

export function readTree(dataDir: string): Task | null {
  const file = path.join(dataDir, "tree.json");
  if (!fs.existsSync(file)) return null;
  return ensureCompleted(JSON.parse(fs.readFileSync(file, "utf-8")));
}

export function writeTree(dataDir: string, tree: Task): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "tree.json");
  fs.writeFileSync(file, JSON.stringify(tree, null, 2) + "\n");
}

// --- Plans I/O ---

export function readPlans(dataDir: string): Plan[] {
  const file = path.join(dataDir, "plans.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function writePlans(dataDir: string, plans: Plan[]): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "plans.json");
  fs.writeFileSync(file, JSON.stringify(plans, null, 2) + "\n");
}
