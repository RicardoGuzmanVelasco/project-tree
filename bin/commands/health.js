const path = require("path");
const { readTree, writeTree } = require("../../backend/dist/io");
const { diagnose, repairTree } = require("../../backend/dist/tree-ops");

function doctor(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const { issues } = diagnose(tree);

  if (issues.length === 0) process.exit(0);

  for (const issue of issues) {
    const locs = issue.occurrences.map(o => `"${o.title}" (${o.path})`).join(" and ");
    console.log(`Duplicate ID #${issue.id}: ${locs}`);
  }

  const noun = issues.length === 1 ? "issue" : "issues";
  console.error(`${issues.length} ${noun} found — run \`project-tree repair\` to fix`);
  process.exit(1);
}

function repair(args, { getFlag }) {
  const dataDir = getFlag("--dir") || path.join(process.cwd(), ".project-tree");
  const tree = readTree(dataDir);
  if (!tree) { console.error(`No tree.json found in ${dataDir}`); process.exit(1); }

  const { tree: newTree, result } = repairTree(tree);

  if (result.renames.length === 0) process.exit(0);

  writeTree(dataDir, newTree);

  for (const r of result.renames) {
    console.log(`Renamed #${r.from} → #${r.to} ("${r.title}" — was duplicate)`);
  }

  const noun = result.renames.length === 1 ? "fix" : "fixes";
  console.log(`${result.renames.length} ${noun} applied`);
  process.exit(0);
}

module.exports = { doctor, repair };
