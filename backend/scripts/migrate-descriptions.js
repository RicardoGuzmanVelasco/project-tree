#!/usr/bin/env node
// One-time migration: moves task descriptions from tree.json to descriptions/<id>.md

const fs = require("fs");
const path = require("path");

const dataDir = process.argv[2] || path.join(process.cwd(), ".project-tree");
const treeFile = path.join(dataDir, "tree.json");
const descDir = path.join(dataDir, "descriptions");

if (!fs.existsSync(treeFile)) {
  console.error(`No tree.json found in ${dataDir}`);
  process.exit(1);
}

const tree = JSON.parse(fs.readFileSync(treeFile, "utf-8"));

let migrated = 0;

function walk(node) {
  if (node.description) {
    if (!fs.existsSync(descDir)) fs.mkdirSync(descDir, { recursive: true });
    fs.writeFileSync(path.join(descDir, `${node.id}.md`), node.description);
    console.log(`  #${node.id} "${node.title}" → descriptions/${node.id}.md`);
    delete node.description;
    migrated++;
  }
  for (const child of node.children || []) walk(child);
}

walk(tree);

if (migrated === 0) {
  console.log("No descriptions found in tree.json — nothing to migrate.");
  process.exit(0);
}

fs.writeFileSync(treeFile, JSON.stringify(tree, null, 2) + "\n");
console.log(`\nMigrated ${migrated} description(s). tree.json updated.`);
