#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { readTree, writeTree, readPlans, writePlans } = require("../backend/dist/io");
const { findTask, findParent, maxId, countDescendants, countCompletedDescendants, computeMaxDepth, isPrunable, formatPrunedTree, countNodes, nextPlanId } = require("../backend/dist/tree-ops");

// --- Argument parsing ---

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args[0] : "serve";

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

// --- Help ---

const HELP = `
  project-tree — visual task tree for any project

  Usage:
    project-tree                Open the web viewer (default)
    project-tree init           Create .project-tree/ in the current directory
    project-tree print [id]     Print a subtree to the terminal

  Options:
    --port <n>     Use a different port (default: 3001)
    --no-open      Don't open the browser
    --dir <path>   Use a different data directory
    --ids          Show task IDs (with print command)
    --depth <n>    Max depth to display (default: 3)
    --all          Show full tree without depth limit

  Examples:
    project-tree                    # open viewer for current project
    project-tree init               # initialize a new project tree
    project-tree print               # print tree (depth 3)
    project-tree print --all         # print full tree
    project-tree print 42 --ids     # print subtree from task #42 with IDs
    project-tree print --depth 2    # print tree limited to 2 levels
    project-tree --port 3005        # serve on a custom port
`.trimStart();

if (hasFlag("--help") || hasFlag("-h") || command === "help") {
  process.stdout.write(HELP);
  process.exit(0);
}

// --- Init command ---

if (command === "init") {
  const dir = path.join(process.cwd(), ".project-tree");
  if (fs.existsSync(path.join(dir, "tree.json"))) {
    console.log(".project-tree/ already exists.");
    process.exit(0);
  }

  const name = path.basename(process.cwd());
  const tree = { id: 1, title: name, completed: false, children: [] };

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "tree.json"), JSON.stringify(tree, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "plans.json"), "[]\n");

  console.log(`Initialized .project-tree/ for "${name}"`);
  console.log("Run 'project-tree' to open the viewer.");
  process.exit(0);
}

// --- Create command ---

if (command === "create") {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const parentId = parseInt(args[1], 10);
  const title = args.find((a, i) => i > 1 && !a.startsWith("-") && args[i - 1] !== "--dir");

  if (!parentId || isNaN(parentId) || !title) {
    console.error("Usage: project-tree create <parentId> \"title\"");
    process.exit(1);
  }

  const tree = readTree(dataDir);
  if (!tree) {
    console.error(`No tree.json found in ${dataDir}`);
    process.exit(1);
  }

  const parent = findTask(tree, parentId);
  if (!parent) {
    console.error(`Parent task #${parentId} not found.`);
    process.exit(1);
  }

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

// --- Plans command ---

if (command === "plans") {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");

  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const plans = readPlans(dataDir);
  const activePlans = plans.filter(p => !p.archived);
  const archivedPlans = plans.filter(p => p.archived);

  if (activePlans.length === 0 && archivedPlans.length === 0) {
    console.log("No plans.");
    process.exit(0);
  }

  for (const plan of activePlans) {
    const completed = plan.taskIds.filter(id => {
      const t = findTask(tree, id);
      return t && (t.completed || t.abandoned);
    }).length;
    console.log(`  ${plan.name} (${completed}/${plan.taskIds.length})`);
  }

  if (archivedPlans.length > 0) {
    console.log(`\n  (${archivedPlans.length} archived)`);
  }

  process.exit(0);
}

// --- Plan subcommands ---

if (command === "plan") {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const subcommand = args[1];

  if (!subcommand) {
    console.error("Usage: project-tree plan <create|add|remove|archive|name>");
    process.exit(1);
  }

  // plan create "name"
  if (subcommand === "create") {
    const name = args[2];
    if (!name) {
      console.error('Usage: project-tree plan create "name"');
      process.exit(1);
    }
    const plans = readPlans(dataDir);
    const plan = { id: nextPlanId(plans), name: name.trim(), taskIds: [] };
    plans.push(plan);
    writePlans(dataDir, plans);
    console.log(`Created plan "${plan.name}"`);
    process.exit(0);
  }

  // plan add <planName> <taskId>
  if (subcommand === "add") {
    const planName = args[2];
    const taskId = parseInt(args[3], 10);
    if (!planName || !taskId || isNaN(taskId)) {
      console.error("Usage: project-tree plan add <planName> <taskId>");
      process.exit(1);
    }
    const plans = readPlans(dataDir);
    const plan = plans.find(p => p.name === planName);
    if (!plan) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    const tree = readTree(dataDir);
    if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }
    const task = findTask(tree, taskId);
    if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

    if (plan.taskIds.includes(taskId)) {
      console.log(`Task #${taskId} is already in plan "${planName}".`);
      process.exit(0);
    }

    plan.taskIds.push(taskId);
    writePlans(dataDir, plans);
    console.log(`Added task #${taskId} "${task.title}" to plan "${planName}"`);
    process.exit(0);
  }

  // plan remove <planName> <taskId>
  if (subcommand === "remove") {
    const planName = args[2];
    const taskId = parseInt(args[3], 10);
    if (!planName || !taskId || isNaN(taskId)) {
      console.error("Usage: project-tree plan remove <planName> <taskId>");
      process.exit(1);
    }
    const plans = readPlans(dataDir);
    const plan = plans.find(p => p.name === planName);
    if (!plan) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    if (!plan.taskIds.includes(taskId)) {
      console.log(`Task #${taskId} is not in plan "${planName}".`);
      process.exit(0);
    }

    plan.taskIds = plan.taskIds.filter(id => id !== taskId);
    writePlans(dataDir, plans);
    console.log(`Removed task #${taskId} from plan "${planName}"`);
    process.exit(0);
  }

  // plan archive <planName>
  if (subcommand === "archive") {
    const planName = args[2];
    if (!planName) {
      console.error("Usage: project-tree plan archive <planName>");
      process.exit(1);
    }
    const plans = readPlans(dataDir);
    const plan = plans.find(p => p.name === planName);
    if (!plan) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    plan.archived = true;
    writePlans(dataDir, plans);
    console.log(`Archived plan "${planName}"`);
    process.exit(0);
  }

  // plan <name> — print tree filtered by plan
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const plans = readPlans(dataDir);
  const plan = plans.find(p => p.name === subcommand);
  if (!plan) { console.error(`Plan "${subcommand}" not found.`); process.exit(1); }

  const showIds = hasFlag("--ids");
  const taskIdSet = new Set(plan.taskIds);
  const completed = plan.taskIds.filter(id => {
    const t = findTask(tree, id);
    return t && (t.completed || t.abandoned);
  }).length;

  console.log(`Plan: ${plan.name} (${completed}/${plan.taskIds.length})\n`);

  function statusIcon(t) {
    if (t.abandoned) return "[~]";
    if (t.completed) return "[x]";
    return "[ ]";
  }

  function printPlanTree(node, prefix, isLast, isRoot) {
    const inPlan = taskIdSet.has(node.id);
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const idLabel = showIds && node.id >= 0 ? `#${node.id} ` : "";
    const status = isRoot ? "" : `${statusIcon(node)} `;
    const dim = !isRoot && !inPlan ? "\x1b[2m" : "";
    const reset = dim ? "\x1b[0m" : "";
    console.log(`${prefix}${connector}${dim}${status}${idLabel}${node.title}${reset}`);

    // Only descend into children if this node or any descendant is in the plan
    const children = (node.children || []).filter(c => hasRelevantDescendant(c));
    const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
    children.forEach((child, i) => {
      printPlanTree(child, childPrefix, i === children.length - 1, false);
    });
  }

  function hasRelevantDescendant(node) {
    if (taskIdSet.has(node.id)) return true;
    return (node.children || []).some(hasRelevantDescendant);
  }

  printPlanTree(tree, "", true, true);
  process.exit(0);
}

// --- Describe command ---

if (command === "describe") {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const taskId = parseInt(args[1], 10);
  // Everything after taskId and flags is the description text
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

  // Read mode: no description argument provided
  if (newDesc === null) {
    if (task.description) {
      console.log(`#${taskId} ${task.title}\n`);
      console.log(task.description);
    } else {
      console.log(`Task #${taskId} "${task.title}" has no description.`);
    }
    process.exit(0);
  }

  // Write mode: set description
  task.description = newDesc || undefined;
  writeTree(dataDir, tree);
  console.log(newDesc ? `Description set for task #${taskId}` : `Description cleared for task #${taskId}`);
  process.exit(0);
}

// --- Prune command ---

if (command === "prune") {
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

  // Build pruned summary for description
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

// --- Rename command ---

if (command === "rename") {
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

// --- Move command ---

if (command === "move") {
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

// --- Delete command ---

if (command === "delete") {
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

// --- Complete command ---

if (command === "complete") {
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

// --- Abandon command ---

if (command === "abandon") {
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

// --- Print command ---

if (command === "print") {
  const DEFAULT_DEPTH = 3;

  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const showIds = hasFlag("--ids");
  const depthFlag = getFlag("--depth");
  const maxDepth = depthFlag !== undefined ? parseInt(depthFlag, 10) : (hasFlag("--all") ? Infinity : DEFAULT_DEPTH);

  const tree = readTree(dataDir);
  if (!tree) {
    console.error(`No tree.json found in ${dataDir}`);
    process.exit(1);
  }

  // Task ID is the first non-flag argument after "print"
  const idArg = args.find((a, i) => i > 0 && !a.startsWith("-") && args[i - 1] !== "--dir" && args[i - 1] !== "--depth");
  const taskId = idArg ? parseInt(idArg, 10) : tree.id;

  const task = findTask(tree, taskId);
  if (!task) {
    console.error(`Task #${taskId} not found.`);
    process.exit(1);
  }

  function statusIcon(t) {
    if (t.abandoned) return "[~]";
    if (t.completed) return "[x]";
    return "[ ]";
  }

  function renderTree(node, prefix, isLast, isRoot, depth) {
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const idLabel = showIds && node.id >= 0 ? `#${node.id} ` : "";
    const status = isRoot ? "" : `${statusIcon(node)} `;

    const children = node.children || [];

    // At depth limit with hidden children: show truncation indicator
    if (depth >= maxDepth && children.length > 0) {
      const dc = countDescendants(node);
      const cc = countCompletedDescendants(node);
      console.log(`${prefix}${connector}${status}${idLabel}${node.title}  (+${dc} tareas, ${cc} completadas)`);
      return;
    }

    console.log(`${prefix}${connector}${status}${idLabel}${node.title}`);

    const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
    children.forEach((child, i) => {
      renderTree(child, childPrefix, i === children.length - 1, false, depth + 1);
    });
  }

  renderTree(task, "", true, true, 0);
  process.exit(0);
}

// --- Serve command (default) ---

const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
const port = parseInt(getFlag("--port") || "3001", 10);
const noOpen = hasFlag("--no-open");

if (!fs.existsSync(path.join(dataDir, "tree.json"))) {
  console.error(`No tree.json found in ${dataDir}`);
  console.error("Run 'project-tree init' to create one.");
  process.exit(1);
}

const frontendDist = path.join(__dirname, "..", "frontend", "dist");
const { startServer } = require("../backend/dist/index.js");

startServer({
  dataDir,
  port,
  frontendDist,
  onReady(actualPort) {
    if (!noOpen) {
      const url = `http://localhost:${actualPort}`;
      try {
        if (process.platform === "darwin") execSync(`open ${url}`);
        else if (process.platform === "linux") execSync(`xdg-open ${url}`);
        else if (process.platform === "win32") execSync(`start ${url}`);
      } catch {
        // Silently fail if browser can't be opened
      }
    }
  },
});
