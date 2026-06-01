import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";

const app = express();
const PORT = 3001;
const TREES_DIR = path.join(__dirname, "..", "data", "trees");
const PLANS_DIR = path.join(__dirname, "..", "data", "plans");
const EXTERNAL_FILE = path.join(__dirname, "..", "data", "external.json");

type ExternalRegistry = Record<string, string>; // slug → directory path

function loadExternalRegistry(): ExternalRegistry {
  if (!fs.existsSync(EXTERNAL_FILE)) return {};
  return JSON.parse(fs.readFileSync(EXTERNAL_FILE, "utf-8"));
}

function resolveTreePath(slug: string): string {
  const ext = loadExternalRegistry()[slug];
  if (ext) return path.join(ext, "tree.json");
  return path.join(TREES_DIR, `${slug}.json`);
}

function resolvePlansPath(slug: string): string {
  const ext = loadExternalRegistry()[slug];
  if (ext) return path.join(ext, "plans.json");
  return path.join(PLANS_DIR, `${slug}.json`);
}

function isExternal(slug: string): boolean {
  return slug in loadExternalRegistry();
}

app.use(cors());
app.use(express.json());

function ensureCompleted(node: Task): Task {
  return {
    ...node,
    completed: node.completed ?? false,
    children: node.children.map(ensureCompleted),
  };
}

const SLUG_RE = /^[a-z0-9-]+$/;

const trees = new Map<string, Task>();

function getTree(slug: string): Task | null {
  if (!isExternal(slug) && trees.has(slug)) return trees.get(slug)!;
  const filePath = resolveTreePath(slug);
  if (!fs.existsSync(filePath)) return null;
  const tree = ensureCompleted(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  trees.set(slug, tree);
  return tree;
}

function saveTree(slug: string) {
  const tree = trees.get(slug);
  if (!tree) return;
  fs.writeFileSync(resolveTreePath(slug), JSON.stringify(tree, null, 2) + "\n");
}

function findTask(node: Task, id: number): Task | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findTask(child, id);
    if (found) return found;
  }
  return null;
}

function findParent(node: Task, taskId: number): Task | null {
  for (const child of node.children) {
    if (child.id === taskId) return node;
    const found = findParent(child, taskId);
    if (found) return found;
  }
  return null;
}

function maxId(node: Task): number {
  return Math.max(node.id, ...node.children.map(maxId));
}

app.get("/projects", (_req, res) => {
  const localFiles = fs.readdirSync(TREES_DIR).filter(f => f.endsWith(".json")).sort();
  const localSlugs = localFiles.map(f => f.replace(".json", ""));
  const externalSlugs = Object.keys(loadExternalRegistry());
  const allSlugs = [...new Set([...localSlugs, ...externalSlugs])].sort();
  const projects = allSlugs.map(slug => {
    const tree = getTree(slug);
    return { slug, title: tree?.title ?? slug };
  });
  res.json(projects);
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

app.post("/projects", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" }); return;
  }
  const slug = slugify(name.trim());
  if (!slug) {
    res.status(400).json({ error: "Invalid name (cannot generate slug)" }); return;
  }
  const filePath = resolveTreePath(slug);
  if (fs.existsSync(filePath)) {
    res.status(409).json({ error: "Project already exists" }); return;
  }
  const root: Task = { id: 1, title: name.trim(), completed: false, children: [] };
  trees.set(slug, root);
  saveTree(slug);
  res.status(201).json({ slug, title: root.title });
});

app.get("/projects/:slug/tasks", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const tree = getTree(slug);
  if (!tree) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(tree);
});

app.post("/projects/:slug/tasks", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const tree = getTree(slug);
  if (!tree) { res.status(404).json({ error: "Project not found" }); return; }

  const { parentId, title, description } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const parent = findTask(tree, parentId);
  if (!parent) {
    res.status(400).json({ error: "Parent task not found" });
    return;
  }

  const newTask: Task = {
    id: maxId(tree) + 1,
    title: title.trim(),
    ...(typeof description === "string" ? { description } : {}),
    completed: false,
    children: [],
  };

  parent.children.push(newTask);
  saveTree(slug);

  res.status(201).json(newTask);
});

app.patch("/projects/:slug/tasks/:id", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const tree = getTree(slug);
  if (!tree) { res.status(404).json({ error: "Project not found" }); return; }

  const id = Number(req.params.id);
  const { completed, abandoned, parentId, title, description } = req.body;

  if (typeof completed !== "boolean" && typeof abandoned !== "boolean" && typeof parentId !== "number" && typeof title !== "string" && typeof description !== "string") {
    res.status(400).json({ error: "completed (boolean), abandoned (boolean), parentId (number), title (string), or description (string) is required" });
    return;
  }

  const task = findTask(tree, id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (typeof title === "string") {
    const trimmed = title.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Title cannot be empty" });
      return;
    }
    task.title = trimmed;
    saveTree(slug);
    res.json(task);
    return;
  }

  if (typeof description === "string") {
    task.description = description || undefined;
    saveTree(slug);
    res.json(task);
    return;
  }

  if (typeof parentId === "number") {
    if (id === tree.id) {
      res.status(400).json({ error: "Cannot relocate the root task" });
      return;
    }

    const newParent = findTask(tree, parentId);
    if (!newParent) {
      res.status(400).json({ error: "New parent task not found" });
      return;
    }

    if (findTask(task, parentId)) {
      res.status(400).json({ error: "Cannot relocate to a descendant" });
      return;
    }

    const currentParent = findParent(tree, id);
    if (currentParent && currentParent.id !== parentId) {
      currentParent.children = currentParent.children.filter(c => c.id !== id);
      newParent.children.push(task);
    }

    saveTree(slug);
    res.json(task);
    return;
  }

  if (typeof abandoned === "boolean") {
    task.abandoned = abandoned || undefined;
    if (abandoned) task.completed = false;
    saveTree(slug);
    res.json(task);
    return;
  }

  task.completed = completed;
  if (completed) task.abandoned = undefined;
  saveTree(slug);

  res.json(task);
});

function isPrunable(task: Task): boolean {
  if (!task.completed && !task.abandoned) return false;
  return task.children.every(isPrunable);
}

function formatPrunedTree(task: Task, indent: number = 0): string {
  const prefix = "  ".repeat(indent) + "- ";
  const status = task.abandoned ? " [abandoned]" : "";
  let result = prefix + task.title + status + "\n";
  for (const child of task.children) {
    result += formatPrunedTree(child, indent + 1);
  }
  return result;
}

function countNodes(task: Task): number {
  return 1 + task.children.reduce((sum, c) => sum + countNodes(c), 0);
}

app.post("/projects/:slug/tasks/:id/prune", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const tree = getTree(slug);
  if (!tree) { res.status(404).json({ error: "Project not found" }); return; }

  const id = Number(req.params.id);
  const task = findTask(tree, id);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const prunableChildren = task.children.filter(isPrunable);
  if (prunableChildren.length === 0) {
    res.status(400).json({ error: "No prunable children" }); return;
  }

  // Build the pruned summary
  let summary = "--- Pruned ---\n";
  for (const child of prunableChildren) {
    summary += formatPrunedTree(child);
  }

  // Append to description
  const existing = task.description || "";
  task.description = existing ? existing + "\n\n" + summary.trimEnd() : summary.trimEnd();

  // Remove prunable children
  const prunableIds = new Set(prunableChildren.map(c => c.id));
  task.children = task.children.filter(c => !prunableIds.has(c.id));

  const prunedCount = prunableChildren.reduce((sum, c) => sum + countNodes(c), 0);

  saveTree(slug);
  res.json({ task, prunedCount });
});

app.delete("/projects/:slug/tasks/:id", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const tree = getTree(slug);
  if (!tree) { res.status(404).json({ error: "Project not found" }); return; }

  const id = Number(req.params.id);

  if (id === tree.id) {
    res.status(400).json({ error: "Cannot delete the root task" });
    return;
  }

  const task = findTask(tree, id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const parent = findParent(tree, id);
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== id);
  }

  saveTree(slug);
  res.json({ deleted: id });
});

// --- Plans ---

function getPlans(slug: string): Plan[] {
  const file = resolvePlansPath(slug);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function savePlans(slug: string, plans: Plan[]) {
  const file = resolvePlansPath(slug);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plans, null, 2) + "\n");
}

function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}

app.get("/projects/:slug/plans", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  res.json(getPlans(slug));
});

app.post("/projects/:slug/plans", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const { name, taskIds } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" }); return;
  }
  if (!Array.isArray(taskIds) || !taskIds.every(id => typeof id === "number")) {
    res.status(400).json({ error: "taskIds must be an array of numbers" }); return;
  }
  const plans = getPlans(slug);
  const plan: Plan = { id: nextPlanId(plans), name: name.trim(), taskIds };
  plans.push(plan);
  savePlans(slug, plans);
  res.status(201).json(plan);
});

app.get("/projects/:slug/plans/:planId", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const planId = Number(req.params.planId);
  const plan = getPlans(slug).find(p => p.id === planId);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

app.patch("/projects/:slug/plans/:planId", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const planId = Number(req.params.planId);
  const plans = getPlans(slug);
  const plan = plans.find(p => p.id === planId);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  const { name, taskIds, archived } = req.body;
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) { res.status(400).json({ error: "Name cannot be empty" }); return; }
    plan.name = trimmed;
  }
  if (typeof archived === "boolean") {
    plan.archived = archived || undefined;
  }
  if (Array.isArray(taskIds)) {
    if (!taskIds.every(id => typeof id === "number")) {
      res.status(400).json({ error: "taskIds must be numbers" }); return;
    }
    plan.taskIds = taskIds;
  }
  savePlans(slug, plans);
  res.json(plan);
});

app.delete("/projects/:slug/plans/:planId", (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Invalid project slug" }); return; }
  const planId = Number(req.params.planId);
  const plans = getPlans(slug);
  const idx = plans.findIndex(p => p.id === planId);
  if (idx === -1) { res.status(404).json({ error: "Plan not found" }); return; }
  plans.splice(idx, 1);
  savePlans(slug, plans);
  res.json({ deleted: planId });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
