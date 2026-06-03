const path = require("path");
const { readTree, writeTree } = require("../../backend/dist/io");
const { findTask, findParent, maxId, countDescendants, isPrunable, formatPrunedTree, countNodes } = require("../../backend/dist/tree-ops");

function create(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const parentId = parseInt(args[1], 10);
  const title = args.find((a, i) => i > 1 && !a.startsWith("-") && args[i - 1] !== "--dir");

  if (!parentId || isNaN(parentId) || !title) {
    console.error("Usage: project-tree create <parentId> \"title\"");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const parent = findTask(tree, parentId);
  if (!parent) { console.error(`Parent task #${parentId} not found.`); process.exit(1); }

  const newTask = {
    id: maxId(tree) + 1,
    title: title.trim(),
    completed: false,
    children: [],
  };

  parent.children.push(newTask);
  writeTree(dataDir, tree);

  console.log(`Created task #${newTask.id} "${newTask.title}" under #${parentId}`);
  process.exit(0);
}

function complete(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree complete <taskId>");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  task.completed = !task.completed;
  if (task.completed) task.abandoned = undefined;
  writeTree(dataDir, tree);

  console.log(`Task #${taskId} "${task.title}" ${task.completed ? "completed" : "uncompleted"}`);
  process.exit(0);
}

function abandon(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree abandon <taskId>");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  const wasAbandoned = !!task.abandoned;
  task.abandoned = wasAbandoned ? undefined : true;
  if (!wasAbandoned) task.completed = false;
  writeTree(dataDir, tree);

  console.log(`Task #${taskId} "${task.title}" ${wasAbandoned ? "restored" : "abandoned"}`);
  process.exit(0);
}

function del(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const force = hasFlag("--force");

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree delete <taskId> [--force]");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  if (taskId === tree.id) {
    console.error("Cannot delete the root task.");
    process.exit(1);
  }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  const dc = countDescendants(task);

  if (!force && dc > 0) {
    console.log(`Task #${taskId} "${task.title}" has ${dc} descendant(s).`);
    console.log("Use --force to confirm deletion.");
    process.exit(1);
  }

  const parent = findParent(tree, taskId);
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== taskId);
  }

  writeTree(dataDir, tree);
  console.log(`Deleted task #${taskId} "${task.title}"${dc > 0 ? ` and ${dc} descendant(s)` : ""}`);
  process.exit(0);
}

function rename(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const newTitle = args.find((a, i) => i > 1 && !a.startsWith("-") && args[i - 1] !== "--dir");

  if (!taskId || isNaN(taskId) || !newTitle) {
    console.error('Usage: project-tree rename <taskId> "new title"');
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  const oldTitle = task.title;
  task.title = newTitle.trim();
  writeTree(dataDir, tree);

  console.log(`Renamed task #${taskId} "${oldTitle}" → "${task.title}"`);
  process.exit(0);
}

function move(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const newParentId = parseInt(args[2], 10);

  if (!taskId || isNaN(taskId) || !newParentId || isNaN(newParentId)) {
    console.error("Usage: project-tree move <taskId> <newParentId>");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  if (taskId === tree.id) {
    console.error("Cannot move the root task.");
    process.exit(1);
  }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  const newParent = findTask(tree, newParentId);
  if (!newParent) { console.error(`New parent #${newParentId} not found.`); process.exit(1); }

  if (findTask(task, newParentId)) {
    console.error("Cannot move a task under its own descendant.");
    process.exit(1);
  }

  const currentParent = findParent(tree, taskId);
  if (currentParent && currentParent.id !== newParentId) {
    currentParent.children = currentParent.children.filter(c => c.id !== taskId);
    newParent.children.push(task);
  }

  writeTree(dataDir, tree);
  console.log(`Moved task #${taskId} "${task.title}" under #${newParentId} "${newParent.title}"`);
  process.exit(0);
}

function describe(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const descArgs = args.slice(2).filter((a, i, arr) => !a.startsWith("-") && arr[i - 1] !== "--dir");
  const newDesc = descArgs.length > 0 ? descArgs.join(" ") : null;

  if (!taskId || isNaN(taskId)) {
    console.error('Usage: project-tree describe <taskId> ["description text"]');
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  if (newDesc === null) {
    if (task.description) {
      console.log(`#${taskId} ${task.title}\n`);
      console.log(task.description);
    } else {
      console.log(`Task #${taskId} "${task.title}" has no description.`);
    }
    process.exit(0);
  }

  task.description = newDesc || undefined;
  writeTree(dataDir, tree);
  console.log(newDesc ? `Description set for task #${taskId}` : `Description cleared for task #${taskId}`);
  process.exit(0);
}

function prune(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const force = hasFlag("--force");

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree prune <taskId> [--force]");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  const prunableChildren = task.children.filter(isPrunable);
  if (prunableChildren.length === 0) {
    console.log(`No prunable children under task #${taskId}.`);
    process.exit(0);
  }

  const prunedCount = prunableChildren.reduce((sum, c) => sum + countNodes(c), 0);

  if (!force) {
    console.log(`Will prune ${prunedCount} task(s) under #${taskId} "${task.title}":\n`);
    for (const child of prunableChildren) {
      process.stdout.write(formatPrunedTree(child));
    }
    console.log("\nUse --force to confirm.");
    process.exit(1);
  }

  let summary = "--- Pruned ---\n";
  for (const child of prunableChildren) {
    summary += formatPrunedTree(child);
  }

  const existing = task.description || "";
  task.description = existing ? existing + "\n\n" + summary.trimEnd() : summary.trimEnd();

  const prunableIds = new Set(prunableChildren.map(c => c.id));
  task.children = task.children.filter(c => !prunableIds.has(c.id));

  writeTree(dataDir, tree);
  console.log(`Pruned ${prunedCount} task(s) from #${taskId} "${task.title}"`);
  process.exit(0);
}

module.exports = { create, complete, abandon, delete: del, rename, move, describe, prune };
