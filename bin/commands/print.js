const { readTree } = require("../../backend/dist/io");
const { findTask, countDescendants, countCompletedDescendants } = require("../../backend/dist/tree-ops");

const DEFAULT_DEPTH = 3;

function run(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || require("path").join(process.cwd(), ".project-tree");
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

module.exports = { run };
