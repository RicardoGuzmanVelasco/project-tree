#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// --- Argument parsing ---

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args[0] : null;

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

const flags = { getFlag, hasFlag };

// --- Help ---

const HELP = `
  project-tree — visual task tree for any project

  Usage:
    project-tree serve                   Open the web viewer
    project-tree init                    Create .project-tree/ in the current directory
    project-tree print [id]              Print a subtree to the terminal
    project-tree create <parentId> "t"   Create a task under a parent
    project-tree complete <id>           Toggle task completion
    project-tree abandon <id>            Toggle task abandonment
    project-tree delete <id> [--force]   Delete a task (and subtree)
    project-tree rename <id> "title"     Rename a task
    project-tree move <id> <parentId>    Move a task under a new parent
    project-tree describe <id> ["text"]  View or set task description
    project-tree prune <id> [--force]    Snapshot all children of <id> aside (zoom-out)
    project-tree prune suggest           Suggest hubs that look ripe for prune
    project-tree pruned                  List parents with a pruned snapshot
    project-tree pruned <id>             Print the pruned snapshot under <id>
    project-tree plans                   List plans with progress
    project-tree plan <name>             Print tree filtered by plan
    project-tree plan create "name"      Create a new plan
    project-tree plan add <name> <id>    Add task to plan [--recursive]
    project-tree plan remove <name> <id> Remove task from plan [--recursive]
    project-tree plan archive <name>     Archive a plan

  Options:
    --port <n>         Use a different port (default: 3001)
    --no-open          Don't open the browser
    --dir <path>       Use a different data directory
    --depth <n>        Max depth to display (default: 3)
    --all              Show full tree without depth limit
    --force            Skip confirmation (delete, prune)
    --show-completed   Include completed/abandoned tasks (hidden by default)
    --show-pruned      Mark tasks with a pruned snapshot (✂)
    --recursive        Include descendants (plan add/remove)

  Examples:
    project-tree serve                    # open web viewer
    project-tree print                    # print tree (depth 3, no completed)
    project-tree print --all              # print full tree
    project-tree print 42 --show-completed # subtree from task #42 including done
    project-tree create 1 "New feature"   # create task under root
    project-tree complete 42              # toggle task #42 completion
    project-tree plans                    # list active plans
`.trimStart();

if (!command || hasFlag("--help") || hasFlag("-h") || command === "help") {
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
  console.log("Run 'project-tree serve' to open the viewer.");
  process.exit(0);
}

// --- Command dispatch ---

const tasks = require("./commands/tasks");
const plans = require("./commands/plans");
const print = require("./commands/print");
const pruned = require("./commands/pruned");

const taskCommands = {
  create: tasks.create,
  complete: tasks.complete,
  abandon: tasks.abandon,
  delete: tasks.delete,
  rename: tasks.rename,
  move: tasks.move,
  describe: tasks.describe,
  prune: tasks.prune,
};

if (command in taskCommands) {
  taskCommands[command](args, flags);
}

if (command === "print") {
  print.run(args, flags);
}

if (command === "pruned") {
  pruned.run(args, flags);
}

if (command === "plans") {
  plans.list(args, flags);
}

if (command === "plan") {
  plans.plan(args, flags);
}

// --- Serve command ---

if (command === "serve") {
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
} else {
  // Unknown command
  console.error(`Unknown command: ${command}`);
  console.error("Run 'project-tree help' for usage.");
  process.exit(1);
}
