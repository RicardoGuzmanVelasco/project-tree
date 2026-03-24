import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task } from "./types";

const app = express();
const PORT = 3001;
const TREES_DIR = path.join(__dirname, "..", "data", "trees");

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

  const { parentId, title } = req.body;

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
  const { completed, parentId, title } = req.body;

  if (typeof completed !== "boolean" && typeof parentId !== "number" && typeof title !== "string") {
    res.status(400).json({ error: "completed (boolean), parentId (number), or title (string) is required" });
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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
