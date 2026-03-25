import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";

const app = express();
const PORT = 3001;
const TREES_DIR = path.join(__dirname, "..", "data", "trees");
const PLANS_DIR = path.join(__dirname, "..", "data", "plans");

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
  if (trees.has(slug)) return trees.get(slug)!;
  const filePath = path.join(TREES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const tree = ensureCompleted(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  trees.set(slug, tree);
  return tree;
}

function saveTree(slug: string) {
  const tree = trees.get(slug);
  if (!tree) return;
  fs.writeFileSync(path.join(TREES_DIR, `${slug}.json`), JSON.stringify(tree, null, 2) + "\n");
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
  const files = fs.readdirSync(TREES_DIR).filter(f => f.endsWith(".json")).sort();
  const projects = files.map(f => {
    const slug = f.replace(".json", "");
    const tree = getTree(slug);
    return { slug, title: tree?.title ?? slug };
  });
  res.json(projects);
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
  const { completed, parentId, title, description } = req.body;

  if (typeof completed !== "boolean" && typeof parentId !== "number" && typeof title !== "string" && typeof description !== "string") {
    res.status(400).json({ error: "completed (boolean), parentId (number), title (string), or description (string) is required" });
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

  task.completed = completed;
  saveTree(slug);

  res.json(task);
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

function plansFile(slug: string): string {
  return path.join(PLANS_DIR, `${slug}.json`);
}

function getPlans(slug: string): Plan[] {
  const file = plansFile(slug);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function savePlans(slug: string, plans: Plan[]) {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
  fs.writeFileSync(plansFile(slug), JSON.stringify(plans, null, 2) + "\n");
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
  const { name, taskIds } = req.body;
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) { res.status(400).json({ error: "Name cannot be empty" }); return; }
    plan.name = trimmed;
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
