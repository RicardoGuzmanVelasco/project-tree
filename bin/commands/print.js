const { readTree } = require("../../backend/dist/io");
const { findTask, countDescendants, countCompletedDescendants } = require("../../backend/dist/tree-ops");
const { listPrunedIds } = require("../../backend/dist/pruned");

const DEFAULT_DEPTH = 3;
const PRUNED_MARK = " ✂";

function parseRenderOptions({ getFlag, hasFlag }, dataDir) {
  const depthFlag = getFlag("--depth");
  return {
    hideCompleted: !hasFlag("--show-completed"),
    maxDepth: depthFlag !== undefined ? parseInt(depthFlag, 10) : (hasFlag("--all") ? Infinity : DEFAULT_DEPTH),
    prunedIds: hasFlag("--show-pruned") ? listPrunedIds(dataDir) : new Set(),
  };
}

function renderForest(roots, opts) {
  roots.forEach((root, i) => {
    renderNode(root, "", i === roots.length - 1, true, 0, opts);
  });
}

function renderNode(node, prefix, isLast, isRoot, depth, opts) {
  const connector = isRoot ? "" : isLast ? "└── " : "├── ";
  const idLabel = node.id >= 0 ? `#${node.id} ` : "";
  const status = isRoot ? "" : `${statusIcon(node)} `;
  const prunedMark = opts.prunedIds.has(node.id) ? PRUNED_MARK : "";

  const allChildren = node.children || [];

  if (depth >= opts.maxDepth && allChildren.length > 0) {
    const dc = countDescendants(node);
    const cc = countCompletedDescendants(node);
    console.log(`${prefix}${connector}${status}${idLabel}${node.title}${prunedMark}  (+${dc} tareas, ${cc} completadas)`);
    return;
  }

  const visibleChildren = opts.hideCompleted ? allChildren.filter(c => !isDone(c)) : allChildren;
  const hiddenCount = allChildren.length - visibleChildren.length;

  console.log(`${prefix}${connector}${status}${idLabel}${node.title}${prunedMark}`);

  const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");

  visibleChildren.forEach((child, i) => {
    const last = hiddenCount > 0 ? false : i === visibleChildren.length - 1;
    renderNode(child, childPrefix, last, false, depth + 1, opts);
  });

  if (hiddenCount > 0) {
    const dimStart = process.stdout.isTTY ? "\x1b[2m" : "";
    const dimEnd = process.stdout.isTTY ? "\x1b[0m" : "";
    console.log(`${childPrefix}└── ${dimStart}(${hiddenCount} completadas ocultas)${dimEnd}`);
  }
}

function statusIcon(t) {
  if (t.abandoned) return "[~]";
  if (t.completed) return "[x]";
  return "[ ]";
}

function isDone(t) {
  return t.completed || t.abandoned;
}

function run(args, flags) {
  const { getFlag } = flags;
  const dataDir = getFlag("--dir") || require("path").join(process.cwd(), ".project-tree");

  const tree = readTree(dataDir);
  if (!tree) {
    console.error(`No tree.json found in ${dataDir}`);
    process.exit(1);
  }

  const idArg = args.find((a, i) => i > 0 && !a.startsWith("-") && args[i - 1] !== "--dir" && args[i - 1] !== "--depth");
  const taskId = idArg ? parseInt(idArg, 10) : tree.id;

  const task = findTask(tree, taskId);
  if (!task) {
    console.error(`Task #${taskId} not found.`);
    process.exit(1);
  }

  renderForest([task], parseRenderOptions(flags, dataDir));
  process.exit(0);
}

module.exports = { run, renderForest, parseRenderOptions };
