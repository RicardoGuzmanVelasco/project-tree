import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task } from "./types";

const app = express();
const PORT = 3001;
const TREE_PATH = path.join(__dirname, "..", "data", "tree.json");

app.use(cors());

const tree: Task = JSON.parse(fs.readFileSync(TREE_PATH, "utf-8"));

app.get("/tasks", (_req, res) => {
  res.json(tree);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
