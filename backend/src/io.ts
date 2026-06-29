import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";
import { ensureCompleted } from "./tree-ops";

const DESCRIPTIONS_DIR = "descriptions";

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

// --- Descriptions I/O ---

function descriptionsDir(dataDir: string): string {
  return path.join(dataDir, DESCRIPTIONS_DIR);
}

export function readDescription(dataDir: string, id: number): string | undefined {
  const file = path.join(descriptionsDir(dataDir), `${id}.md`);
  if (!fs.existsSync(file)) return undefined;
  return fs.readFileSync(file, "utf-8");
}

export function writeDescription(dataDir: string, id: number, text: string): void {
  const dir = descriptionsDir(dataDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.md`), text);
}

export function deleteDescription(dataDir: string, id: number): void {
  const file = path.join(descriptionsDir(dataDir), `${id}.md`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function listDescriptionIds(dataDir: string): Set<number> {
  const dir = descriptionsDir(dataDir);
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir)
      .filter(f => f.endsWith(".md"))
      .map(f => parseInt(f.slice(0, -3), 10))
      .filter(n => !isNaN(n))
  );
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
