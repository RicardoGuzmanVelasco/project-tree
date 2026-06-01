import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Resolve data directory: --dir flag, or .project-tree/ in cwd
function resolveDataDir(): string {
  const dirIdx = process.argv.indexOf("--dir");
  if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
    return path.resolve(process.argv[dirIdx + 1]);
  }
  return path.join(process.cwd(), ".project-tree");
}

const DATA_DIR = resolveDataDir();
const TREE_FILE = path.join(DATA_DIR, "tree.json");
const PLANS_FILE = path.join(DATA_DIR, "plans.json");

app.use(cors());
app.use(express.json());

// --- Tree ---

function ensureCompleted(node: Task): Task {
  return {
    ...node,
    completed: node.completed ?? false,
    children: node.children.map(ensureCompleted),
  };
}

let tree: Task | null = null;

function getTree(): Task | null {
  if (tree) return tree;
  if (!fs.existsSync(TREE_FILE)) return null;
  tree = ensureCompleted(JSON.parse(fs.readFileSync(TREE_FILE, "utf-8")));
  return tree;
}

function saveTree() {
  if (!tree) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TREE_FILE, JSON.stringify(tree, null, 2) + "\n");
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

function requireTree(_req: express.Request, res: express.Response): Task | null {
  const t = getTree();
  if (!t) { res.status(404).json({ error: "No tree found. Run 'project-tree init' first." }); return null; }
  return t;
}

// --- Task routes ---

app.get("/tasks", (_req, res) => {
  const t = requireTree(_req, res);
  if (!t) return;
  res.json(t);
});

app.post("/tasks", (req, res) => {
  const t = requireTree(req, res);
  if (!t) return;

  const { parentId, title, description } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const parent = findTask(t, parentId);
  if (!parent) {
    res.status(400).json({ error: "Parent task not found" });
    return;
  }

  const newTask: Task = {
    id: maxId(t) + 1,
    title: title.trim(),
    ...(typeof description === "string" ? { description } : {}),
    completed: false,
    children: [],
  };

  parent.children.push(newTask);
  saveTree();

  res.status(201).json(newTask);
});

app.patch("/tasks/:id", (req, res) => {
  const t = requireTree(req, res);
  if (!t) return;

  const id = Number(req.params.id);
  const { completed, abandoned, parentId, title, description } = req.body;

  if (typeof completed !== "boolean" && typeof abandoned !== "boolean" && typeof parentId !== "number" && typeof title !== "string" && typeof description !== "string") {
    res.status(400).json({ error: "completed (boolean), abandoned (boolean), parentId (number), title (string), or description (string) is required" });
    return;
  }

  const task = findTask(t, id);
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
    saveTree();
    res.json(task);
    return;
  }

  if (typeof description === "string") {
    task.description = description || undefined;
    saveTree();
    res.json(task);
    return;
  }

  if (typeof parentId === "number") {
    if (id === t.id) {
      res.status(400).json({ error: "Cannot relocate the root task" });
      return;
    }

    const newParent = findTask(t, parentId);
    if (!newParent) {
      res.status(400).json({ error: "New parent task not found" });
      return;
    }

    if (findTask(task, parentId)) {
      res.status(400).json({ error: "Cannot relocate to a descendant" });
      return;
    }

    const currentParent = findParent(t, id);
    if (currentParent && currentParent.id !== parentId) {
      currentParent.children = currentParent.children.filter(c => c.id !== id);
      newParent.children.push(task);
    }

    saveTree();
    res.json(task);
    return;
  }

  if (typeof abandoned === "boolean") {
    task.abandoned = abandoned || undefined;
    if (abandoned) task.completed = false;
    saveTree();
    res.json(task);
    return;
  }

  task.completed = completed;
  if (completed) task.abandoned = undefined;
  saveTree();

  res.json(task);
});

// --- Prune ---

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

app.post("/tasks/:id/prune", (req, res) => {
  const t = requireTree(req, res);
  if (!t) return;

  const id = Number(req.params.id);
  const task = findTask(t, id);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const prunableChildren = task.children.filter(isPrunable);
  if (prunableChildren.length === 0) {
    res.status(400).json({ error: "No prunable children" }); return;
  }

  let summary = "--- Pruned ---\n";
  for (const child of prunableChildren) {
    summary += formatPrunedTree(child);
  }

  const existing = task.description || "";
  task.description = existing ? existing + "\n\n" + summary.trimEnd() : summary.trimEnd();

  const prunableIds = new Set(prunableChildren.map(c => c.id));
  task.children = task.children.filter(c => !prunableIds.has(c.id));

  const prunedCount = prunableChildren.reduce((sum, c) => sum + countNodes(c), 0);

  saveTree();
  res.json({ task, prunedCount });
});

app.delete("/tasks/:id", (req, res) => {
  const t = requireTree(req, res);
  if (!t) return;

  const id = Number(req.params.id);

  if (id === t.id) {
    res.status(400).json({ error: "Cannot delete the root task" });
    return;
  }

  const task = findTask(t, id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const parent = findParent(t, id);
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== id);
  }

  saveTree();
  res.json({ deleted: id });
});

// --- Plans ---

function getPlans(): Plan[] {
  if (!fs.existsSync(PLANS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PLANS_FILE, "utf-8"));
}

function savePlans(plans: Plan[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2) + "\n");
}

function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}

app.get("/plans", (_req, res) => {
  res.json(getPlans());
});

app.post("/plans", (req, res) => {
  const { name, taskIds } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" }); return;
  }
  if (!Array.isArray(taskIds) || !taskIds.every(id => typeof id === "number")) {
    res.status(400).json({ error: "taskIds must be an array of numbers" }); return;
  }
  const plans = getPlans();
  const plan: Plan = { id: nextPlanId(plans), name: name.trim(), taskIds };
  plans.push(plan);
  savePlans(plans);
  res.status(201).json(plan);
});

app.get("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plan = getPlans().find(p => p.id === planId);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

app.patch("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plans = getPlans();
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
  savePlans(plans);
  res.json(plan);
});

app.delete("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plans = getPlans();
  const idx = plans.findIndex(p => p.id === planId);
  if (idx === -1) { res.status(404).json({ error: "Plan not found" }); return; }
  plans.splice(idx, 1);
  savePlans(plans);
  res.json({ deleted: planId });
});

// --- Static frontend ---

const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback: serve index.html for any non-API route
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`project-tree running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
