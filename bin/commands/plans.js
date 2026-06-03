const path = require("path");
const { readTree, readPlans, writePlans } = require("../../backend/dist/io");
const { findTask, nextPlanId } = require("../../backend/dist/tree-ops");

function list(args, { getFlag, hasFlag }) {
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

function plan(args, { getFlag, hasFlag }) {
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
    const p = { id: nextPlanId(plans), name: name.trim(), taskIds: [] };
    plans.push(p);
    writePlans(dataDir, plans);
    console.log(`Created plan "${p.name}"`);
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
    const p = plans.find(p => p.name === planName);
    if (!p) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    const tree = readTree(dataDir);
    if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }
    const task = findTask(tree, taskId);
    if (!task) { console.error(`Task #${taskId} not found.`); process.exit(1); }

    if (p.taskIds.includes(taskId)) {
      console.log(`Task #${taskId} is already in plan "${planName}".`);
      process.exit(0);
    }

    p.taskIds.push(taskId);
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
    const p = plans.find(p => p.name === planName);
    if (!p) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    if (!p.taskIds.includes(taskId)) {
      console.log(`Task #${taskId} is not in plan "${planName}".`);
      process.exit(0);
    }

    p.taskIds = p.taskIds.filter(id => id !== taskId);
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
    const p = plans.find(p => p.name === planName);
    if (!p) { console.error(`Plan "${planName}" not found.`); process.exit(1); }

    p.archived = true;
    writePlans(dataDir, plans);
    console.log(`Archived plan "${planName}"`);
    process.exit(0);
  }

  // plan <name> — print tree filtered by plan
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const plans = readPlans(dataDir);
  const p = plans.find(p => p.name === subcommand);
  if (!p) { console.error(`Plan "${subcommand}" not found.`); process.exit(1); }

  const showIds = hasFlag("--ids");
  const taskIdSet = new Set(p.taskIds);
  const completed = p.taskIds.filter(id => {
    const t = findTask(tree, id);
    return t && (t.completed || t.abandoned);
  }).length;

  console.log(`Plan: ${p.name} (${completed}/${p.taskIds.length})\n`);

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
    const dim = !isRoot && !inPlan && process.stdout.isTTY ? "\x1b[2m" : "";
    const reset = dim ? "\x1b[0m" : "";
    console.log(`${prefix}${connector}${dim}${status}${idLabel}${node.title}${reset}`);

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

module.exports = { list, plan };
