const { readTree } = require("../../backend/dist/io");
const { findTask, countDescendants, countCompletedDescendants } = require("../../backend/dist/tree-ops");

const DEFAULT_DEPTH = 3;

function run(args, { getFlag, hasFlag }) {
  const dataDir = getFlag("--dir") || require("path").join(process.cwd(), ".project-tree");
  const showIds = hasFlag("--ids");
  const hideCompleted = hasFlag("--hide-completed");
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

  function isDone(t) {
    return t.completed || t.abandoned;
  }

  function renderTree(node, prefix, isLast, isRoot, depth) {
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const idLabel = showIds && node.id >= 0 ? `#${node.id} ` : "";
    const status = isRoot ? "" : `${statusIcon(node)} `;

    const allChildren = node.children || [];

    // At depth limit with hidden children: show truncation indicator
    if (depth >= maxDepth && allChildren.length > 0) {
      const dc = countDescendants(node);
      const cc = countCompletedDescendants(node);
      console.log(`${prefix}${connector}${status}${idLabel}${node.title}  (+${dc} tareas, ${cc} completadas)`);
      return;
    }

    // Filter completed children if flag is set
    const visibleChildren = hideCompleted ? allChildren.filter(c => !isDone(c)) : allChildren;
    const hiddenCount = allChildren.length - visibleChildren.length;

    console.log(`${prefix}${connector}${status}${idLabel}${node.title}`);

    const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");

    const totalVisible = visibleChildren.length + (hiddenCount > 0 ? 1 : 0);
    visibleChildren.forEach((child, i) => {
      const last = hiddenCount > 0 ? false : i === visibleChildren.length - 1;
      renderTree(child, childPrefix, last, false, depth + 1);
    });

    if (hiddenCount > 0) {
      const dimStart = process.stdout.isTTY ? "\x1b[2m" : "";
      const dimEnd = process.stdout.isTTY ? "\x1b[0m" : "";
      console.log(`${childPrefix}└── ${dimStart}(${hiddenCount} completadas ocultas)${dimEnd}`);
    }
  }

  renderTree(task, "", true, true, 0);
  process.exit(0);
}

module.exports = { run };
