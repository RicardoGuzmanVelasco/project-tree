const path = require("path");
const { readTree, writeTree, readDescription, writeDescription, deleteDescription } = require("../../backend/dist/io");
const { findTask, findParent, maxId, countDescendants, countNodes, suggestPrunes } = require("../../backend/dist/tree-ops");
const { appendPrunedForest } = require("../../backend/dist/pruned");

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

function complete(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const undo = hasFlag("--undo");

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree complete <taskId> [--undo]");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  if (undo) {
    task.completed = false;
  } else {
    task.completed = true;
    task.abandoned = undefined;
  }
  writeTree(dataDir, tree);

  console.log(`Task #${taskId} "${task.title}" ${undo ? "uncompleted" : "completed"}`);
  process.exit(0);
}

function abandon(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  const undo = hasFlag("--undo");

  if (!taskId || isNaN(taskId)) {
    console.error("Usage: project-tree abandon <taskId> [--undo]");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const task = findTask(tree, taskId);
  if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

  if (undo) {
    task.abandoned = undefined;
  } else {
    task.abandoned = true;
    task.completed = false;
  }
  writeTree(dataDir, tree);

  console.log(`Task #${taskId} "${task.title}" ${undo ? "restored" : "abandoned"}`);
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
    const existing = readDescription(dataDir, taskId);
    if (existing) {
      console.log(`#${taskId} ${task.title}\n`);
      console.log(existing);
    } else {
      console.log(`Task #${taskId} "${task.title}" has no description.`);
    }
    process.exit(0);
  }

  if (newDesc) {
    writeDescription(dataDir, taskId, newDesc);
  } else {
    deleteDescription(dataDir, taskId);
  }
  console.log(newDesc ? `Description set for task #${taskId}` : `Description cleared for task #${taskId}`);
  process.exit(0);
}

const SUGGEST_DEFAULT_MIN_RATIO = 0.8;
const SUGGEST_DEFAULT_MIN_SIZE = 10;
const SUGGEST_DEFAULT_LIMIT = 10;

function prune(args, flags) {
  if (args[1] === "suggest") {
    pruneSuggest(flags);
    return;
  }

  const { getFlag, hasFlag } = flags;
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

  const children = task.children;
  if (children.length === 0) {
    console.log(`No children to prune under task #${taskId}.`);
    process.exit(0);
  }

  const prunedCount = children.reduce((sum, c) => sum + countNodes(c), 0);

  if (!force) {
    console.log(`Will prune ${prunedCount} task(s) under #${taskId} "${task.title}":\n`);
    for (const child of children) {
      previewSubtree(child, 0);
    }
    console.log("\nUse --force to confirm.");
    process.exit(1);
  }

  appendPrunedForest(dataDir, taskId, children);
  task.children = [];
  writeTree(dataDir, tree);
  console.log(`Pruned ${prunedCount} task(s) from #${taskId} "${task.title}" -> pruned/${taskId}.json`);
  process.exit(0);
}

function pruneSuggest({ getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const tree = readTree(dataDir);
  if (!tree) {
    console.error(`No tree.json found in ${dataDir}`);
    process.exit(1);
  }

  const minRatio = getFlag("--min") !== undefined ? parseFloat(getFlag("--min")) / 100 : SUGGEST_DEFAULT_MIN_RATIO;
  const minSize = getFlag("--size") !== undefined ? parseInt(getFlag("--size"), 10) : SUGGEST_DEFAULT_MIN_SIZE;
  const showAll = hasFlag("--all");

  const all = suggestPrunes(tree, { minRatio, minSize });
  if (all.length === 0) {
    console.log("No prune candidates.");
    process.exit(0);
  }

  // Cap by root count, but always render every descendant of a shown root so
  // the hierarchy isn't half-displayed.
  const roots = all.filter(s => s.parentSuggestionId === undefined);
  const shownRoots = showAll ? roots : roots.slice(0, SUGGEST_DEFAULT_LIMIT);
  const shownIds = new Set();
  (function include(rs) {
    for (const r of rs) {
      shownIds.add(r.id);
      include(all.filter(s => s.parentSuggestionId === r.id));
    }
  })(shownRoots);

  const shown = all.filter(s => shownIds.has(s.id));
  const depth = new Map();
  for (const s of all) {
    depth.set(s.id, s.parentSuggestionId === undefined ? 0 : depth.get(s.parentSuggestionId) + 1);
  }
  const prefixWidth = Math.max(...shown.map(s =>
    2 * depth.get(s.id) + `#${s.id} "${s.title}"`.length
  ));

  function render(parentId, level) {
    const siblings = shown.filter(s => (s.parentSuggestionId ?? null) === (parentId ?? null));
    for (const s of siblings) {
      const head = `${"  ".repeat(level)}#${s.id} "${s.title}"`.padEnd(prefixWidth);
      const pct = Math.round(s.ratio * 100);
      console.log(`${head} — ${pct}% (${s.closed} closed / ${s.total} total)`);
      render(s.id, level + 1);
    }
  }
  render(undefined, 0);

  if (!showAll && roots.length > SUGGEST_DEFAULT_LIMIT) {
    console.log(`\n... and ${roots.length - SUGGEST_DEFAULT_LIMIT} more root candidate(s). Use --all to show every one.`);
  }
  process.exit(0);
}

function previewSubtree(node, indent) {
  const prefix = "  ".repeat(indent) + "- ";
  const status = node.abandoned ? " [~]" : node.completed ? " [x]" : "";
  process.stdout.write(`${prefix}#${node.id} ${node.title}${status}\n`);
  for (const child of node.children) previewSubtree(child, indent + 1);
}

module.exports = { create, complete, abandon, delete: del, rename, move, describe, prune };
