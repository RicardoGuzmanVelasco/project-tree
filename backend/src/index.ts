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

let tree: Task = JSON.parse(fs.readFileSync(TREE_PATH, "utf-8"));

function findTask(node: Task, id: number): Task | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findTask(child, id);
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
    children: [],
  };

  parent.children.push(newTask);
  saveTree();

  res.status(201).json(newTask);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
