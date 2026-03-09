import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task } from "./types";

const app = express();
const PORT = 3001;
const TREE_PATH = path.join(__dirname, "..", "data", "tree.json");

app.use(cors());
app.use(express.json());

function ensureCompleted(node: Task): Task {
  return {
    ...node,
    completed: node.completed ?? false,
    children: node.children.map(ensureCompleted),
  };
}

let tree: Task = ensureCompleted(JSON.parse(fs.readFileSync(TREE_PATH, "utf-8")));

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

function saveTree() {
  fs.writeFileSync(TREE_PATH, JSON.stringify(tree, null, 2) + "\n");
}

app.get("/tasks", (_req, res) => {
  res.json(tree);
});

app.post("/tasks", (req, res) => {
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
  saveTree();

  res.status(201).json(newTask);
});

app.patch("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const { completed, parentId } = req.body;

  if (typeof completed !== "boolean" && typeof parentId !== "number") {
    res.status(400).json({ error: "completed (boolean) or parentId (number) is required" });
    return;
  }

  const task = findTask(tree, id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
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

    saveTree();
    res.json(task);
    return;
  }

  task.completed = completed;
  saveTree();

  res.json(task);
});

app.delete("/tasks/:id", (req, res) => {
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

  saveTree();
  res.json({ deleted: id });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
