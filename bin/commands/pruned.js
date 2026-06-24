const path = require("path");
const { readTree } = require("../../backend/dist/io");
const { findTask, suggestPrunes } = require("../../backend/dist/tree-ops");
const { listPrunedIds, readPrunedForest } = require("../../backend/dist/pruned");
const { renderForest, parseRenderOptions } = require("./print");

const DEFAULT_MIN_RATIO = 0.8;
const DEFAULT_MIN_SIZE = 10;
const DEFAULT_LIMIT = 10;

function run(args, flags) {
  const { getFlag } = flags;
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");

  const sub = args.find((a, i) => i > 0 && !a.startsWith("-") && args[i - 1] !== "--dir" && args[i - 1] !== "--depth" && args[i - 1] !== "--min" && args[i - 1] !== "--size");

  if (sub === "suggest") {
    suggest(dataDir, flags);
  } else if (sub) {
    detail(parseInt(sub, 10), dataDir, flags);
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

function suggest(dataDir, { getFlag, hasFlag }) {
  const tree = readTree(dataDir);
  if (!tree) {
    console.error(`No tree.json found in ${dataDir}`);
    process.exit(1);
  }

  const minRatio = getFlag("--min") !== undefined ? parseFloat(getFlag("--min")) / 100 : DEFAULT_MIN_RATIO;
  const minSize = getFlag("--size") !== undefined ? parseInt(getFlag("--size"), 10) : DEFAULT_MIN_SIZE;
  const showAll = hasFlag("--all");

  const all = suggestPrunes(tree, { minRatio, minSize });
  if (all.length === 0) {
    console.log("No prune candidates.");
    process.exit(0);
  }

  const shown = showAll ? all : all.slice(0, DEFAULT_LIMIT);
  const idWidth = Math.max(...shown.map(s => `#${s.id}`.length));
  const titleWidth = Math.max(...shown.map(s => s.title.length));

  for (const s of shown) {
    const id = `#${s.id}`.padEnd(idWidth);
    const title = `"${s.title}"`.padEnd(titleWidth + 2);
    const pct = Math.round(s.ratio * 100);
    console.log(`${id} ${title} — ${pct}% (${s.closed} closed / ${s.total} total)`);
  }

  if (!showAll && all.length > DEFAULT_LIMIT) {
    console.log(`\n... and ${all.length - DEFAULT_LIMIT} more. Use --all to show every candidate.`);
  }
  process.exit(0);
}

module.exports = { run };
