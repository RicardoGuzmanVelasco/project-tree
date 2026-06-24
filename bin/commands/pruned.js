const path = require("path");
const { readTree } = require("../../backend/dist/io");
const { findTask } = require("../../backend/dist/tree-ops");
const { listPrunedIds, readPrunedForest } = require("../../backend/dist/pruned");
const { renderForest, parseRenderOptions } = require("./print");

function run(args, flags) {
  const { getFlag } = flags;
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");

  const idArg = args.find((a, i) => i > 0 && !a.startsWith("-") && args[i - 1] !== "--dir" && args[i - 1] !== "--depth");

  if (idArg) {
    detail(parseInt(idArg, 10), dataDir, flags);
  } else {
    list(dataDir);
  }
}

function list(dataDir) {
  const ids = Array.from(listPrunedIds(dataDir)).sort((a, b) => a - b);
  if (ids.length === 0) {
    console.log("No pruned snapshots.");
    process.exit(0);
  }

  const tree = readTree(dataDir);
  for (const id of ids) {
    const task = tree ? findTask(tree, id) : null;
    const label = task ? `"${task.title}"` : "(orphan)";
    console.log(`#${id} ${label}`);
  }
  process.exit(0);
}

function detail(id, dataDir, flags) {
  if (isNaN(id)) {
    console.error("Usage: project-tree pruned [<id>]");
    process.exit(1);
  }

  const forest = readPrunedForest(dataDir, id);
  if (!forest) {
    console.log(`No pruned snapshot for task #${id}.`);
    process.exit(0);
  }

  const opts = { ...parseRenderOptions(flags, dataDir), showRootStatus: true };
  renderForest(forest, opts);
  process.exit(0);
}

module.exports = { run };
