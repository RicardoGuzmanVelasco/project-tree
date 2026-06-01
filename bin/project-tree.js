#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

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
