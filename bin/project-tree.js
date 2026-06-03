#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { readTree } = require("../backend/dist/io");
const { findTask, countDescendants, countCompletedDescendants, computeMaxDepth } = require("../backend/dist/tree-ops");

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
