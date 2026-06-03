import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Task, Plan } from "./types";
import { findTask, findParent, maxId, isPrunable, formatPrunedTree, countNodes, nextPlanId } from "./tree-ops";
import { readTree, writeTree, readPlans, writePlans } from "./io";

export interface ServerOptions {
  dataDir: string;
  port?: number;
  frontendDist?: string;
  onReady?: (port: number) => void;
}

export function startServer(options: ServerOptions) {
  const { dataDir, port = 3001, onReady } = options;
  const frontendDist = options.frontendDist ?? path.join(__dirname, "..", "..", "frontend", "dist");

const DATA_DIR = path.resolve(dataDir);
const TREE_FILE = path.join(DATA_DIR, "tree.json");

const app = express();
app.use(cors());
app.use(express.json());

// SSE clients
const sseClients = new Set<express.Response>();

function requireTree(_req: express.Request, res: express.Response): Task | null {
  const t = readTree(DATA_DIR);
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
  writeTree(DATA_DIR, t);

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
    writeTree(DATA_DIR, t);
    res.json(task);
    return;
  }

  if (typeof description === "string") {
    task.description = description || undefined;
    writeTree(DATA_DIR, t);
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

    writeTree(DATA_DIR, t);
    res.json(task);
    return;
  }

  if (typeof abandoned === "boolean") {
    task.abandoned = abandoned || undefined;
    if (abandoned) task.completed = false;
    writeTree(DATA_DIR, t);
    res.json(task);
    return;
  }

  task.completed = completed;
  if (completed) task.abandoned = undefined;
  writeTree(DATA_DIR, t);

  res.json(task);
});

// --- Prune ---

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

  writeTree(DATA_DIR, t);
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

  writeTree(DATA_DIR, t);
  res.json({ deleted: id });
});

// --- Plans ---

app.get("/plans", (_req, res) => {
  res.json(readPlans(DATA_DIR));
});

app.post("/plans", (req, res) => {
  const { name, taskIds } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" }); return;
  }
  if (!Array.isArray(taskIds) || !taskIds.every(id => typeof id === "number")) {
    res.status(400).json({ error: "taskIds must be an array of numbers" }); return;
  }
  const plans = readPlans(DATA_DIR);
  const plan: Plan = { id: nextPlanId(plans), name: name.trim(), taskIds };
  plans.push(plan);
  writePlans(DATA_DIR, plans);
  res.status(201).json(plan);
});

app.get("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plan = readPlans(DATA_DIR).find(p => p.id === planId);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

app.patch("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plans = readPlans(DATA_DIR);
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
  writePlans(DATA_DIR, plans);
  res.json(plan);
});

app.delete("/plans/:planId", (req, res) => {
  const planId = Number(req.params.planId);
  const plans = readPlans(DATA_DIR);
  const idx = plans.findIndex(p => p.id === planId);
  if (idx === -1) { res.status(404).json({ error: "Plan not found" }); return; }
  plans.splice(idx, 1);
  writePlans(DATA_DIR, plans);
  res.json({ deleted: planId });
});

// --- SSE endpoint ---

app.get("/events", (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write("data: connected\n\n");
  sseClients.add(res);
  _req.on("close", () => sseClients.delete(res));
});

function broadcastChange() {
  for (const client of sseClients) {
    client.write("data: changed\n\n");
  }
}

// --- File watcher ---

// Watch the real data directory for changes and notify SSE clients.
// Resolves symlinks since fs.watch doesn't follow them on macOS.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const realDataDir = fs.existsSync(TREE_FILE)
  ? path.dirname(fs.realpathSync(TREE_FILE))
  : fs.existsSync(DATA_DIR) ? DATA_DIR : null;
if (realDataDir) {
  fs.watch(realDataDir, (_event, filename) => {
    if (filename !== "tree.json" && filename !== "plans.json") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(broadcastChange, 100);
  });
}

// --- Static frontend ---

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const server = app.listen(port, () => {
  console.log(`project-tree running on http://localhost:${port}`);
  console.log(`Data directory: ${DATA_DIR}`);
  onReady?.(port);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${port} in use, trying ${port + 1}...`);
    const next = port + 1;
    const retry = app.listen(next, () => {
      console.log(`project-tree running on http://localhost:${next}`);
      console.log(`Data directory: ${DATA_DIR}`);
      onReady?.(next);
    });
    retry.on("error", () => {
      console.error(`Ports ${port} and ${next} both in use. Use --port to specify a free port.`);
      process.exit(1);
    });
  } else {
    throw err;
  }
});

} // end startServer

// Direct execution: node backend/dist/index.js [--dir path]
if (require.main === module) {
  function resolveDataDir(): string {
    const dirIdx = process.argv.indexOf("--dir");
    if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
      return path.resolve(process.argv[dirIdx + 1]);
    }
    return path.join(process.cwd(), ".project-tree");
  }
  startServer({
    dataDir: resolveDataDir(),
    port: parseInt(process.env.PORT || "3001", 10),
  });
}
