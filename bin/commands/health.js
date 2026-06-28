const path = require("path");
const { readTree, readPlans, writeTree, writePlans } = require("../../backend/dist/io");
const { diagnose, repairTree } = require("../../backend/dist/tree-ops");

function doctor(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const plans = readPlans(dataDir);
  const { issues } = diagnose(tree, plans);

  if (issues.length === 0) process.exit(0);

  for (const issue of issues) {
    if (issue.type === "duplicate_id") {
      const locs = issue.occurrences.map(o => `"${o.title}" (${o.path})`).join(" and ");
      console.log(`Duplicate ID #${issue.id}: ${locs}`);
    } else {
      console.log(`Broken plan ref: plan "${issue.planName}" references unknown task #${issue.taskId}`);
    }
  }

  const noun = issues.length === 1 ? "issue" : "issues";
  console.error(`${issues.length} ${noun} found — run \`project-tree repair\` to fix`);
  process.exit(1);
}

function repair(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const plans = readPlans(dataDir);
  const { tree: newTree, plans: newPlans, result } = repairTree(tree, plans);

  const total = result.renames.length + result.removedPlanRefs.length;
  if (total === 0) process.exit(0);

  writeTree(dataDir, newTree);
  writePlans(dataDir, newPlans);

  for (const r of result.renames) {
    console.log(`Renamed #${r.from} → #${r.to} ("${r.title}" — was duplicate)`);
  }
  for (const ref of result.removedPlanRefs) {
    console.log(`Removed broken ref #${ref.taskId} from plan "${ref.planName}"`);
  }

  const noun = total === 1 ? "fix" : "fixes";
  console.log(`${total} ${noun} applied`);
  process.exit(0);
}

module.exports = { doctor, repair };
