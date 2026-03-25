import { Task } from "./types";

export interface LayoutNode {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  parentId: number | null;
  task: Task;
  descendantCount: number;
  completedDescendantCount: number;
  isAtomicChild: boolean; // true if rendered as part of a stacked list (leaf under a parent)
}

const NODE_HEIGHT = 36;
const ATOMIC_NODE_HEIGHT = 28;
const CHAR_WIDTH = 8;
const ATOMIC_V_GAP = 4;

// Spacing config — switched by compact mode
let NODE_PADDING_X = 24;
let MIN_NODE_WIDTH = 120;
let MAX_NODE_WIDTH = Infinity;
let H_GAP = 24;
let V_GAP = 56;
let PARENT_TO_CHILDREN_GAP = 16;

function applySpacing(compact: boolean) {
  NODE_PADDING_X = compact ? 12 : 24;
  MIN_NODE_WIDTH = compact ? 80 : 120;
  MAX_NODE_WIDTH = compact ? 260 : Infinity;
  H_GAP = compact ? 6 : 24;
  V_GAP = compact ? 20 : 56;
  PARENT_TO_CHILDREN_GAP = compact ? 6 : 16;
}

function countDescendants(task: Task): number {
  let count = task.children.length;
  for (const child of task.children) count += countDescendants(child);
  return count;
}

function countCompletedDescendants(task: Task): number {
  let count = 0;
  for (const child of task.children) {
    if (child.completed) count++;
    count += countCompletedDescendants(child);
  }
  return count;
}

function nodeWidth(title: string): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, title.length * CHAR_WIDTH + NODE_PADDING_X * 2));
}

interface SubtreeInfo {
  width: number;
  height: number;
  nodes: LayoutNode[];
}

function isLeaf(task: Task): boolean {
  return task.children.length === 0;
}

function areAllChildrenLeaves(task: Task): boolean {
  return task.children.length > 0 && task.children.every(c => isLeaf(c));
}

// Layout a vertical stack of leaf nodes, returning their combined info
// All nodes positioned relative to center x=0
function layoutAtomicStack(
  tasks: Task[],
  parentId: number,
  depth: number,
  startY: number,
  collapsedIds?: Set<number>,
): SubtreeInfo {
  let maxW = 0;
  for (const t of tasks) {
    const w = nodeWidth(t.title);
    if (w > maxW) maxW = w;
  }

  const nodes: LayoutNode[] = [];
  let y = startY;

  for (const t of tasks) {
    const dc = countDescendants(t);
    const cc = countCompletedDescendants(t);
    nodes.push({
      id: t.id,
      x: 0,
      y,
      width: maxW,
      height: ATOMIC_NODE_HEIGHT,
      depth,
      parentId,
      task: t,
      descendantCount: dc,
      completedDescendantCount: cc,
      isAtomicChild: true,
    });
    y += ATOMIC_NODE_HEIGHT + ATOMIC_V_GAP;
  }

  const totalHeight = y - startY - ATOMIC_V_GAP;

  return { width: maxW, height: totalHeight, nodes };
}

function collapsedBadgeWidth(cc: number, dc: number): number {
  const label = `${cc}/${dc}`;
  return label.length * 6 + 10 + 16; // badge + padding around it
}

function layoutSubtree(task: Task, parentId: number | null, depth: number, collapsedIds?: Set<number>): SubtreeInfo {
  const dc = countDescendants(task);
  const cc = countCompletedDescendants(task);
  const isCollapsed = collapsedIds?.has(task.id);
  const baseW = nodeWidth(task.title);
  const w = dc > 0 ? Math.max(baseW, baseW + collapsedBadgeWidth(cc, dc) - NODE_PADDING_X) : baseW;
  const visibleChildren = (!isCollapsed && task.children.length > 0) ? task.children : [];

  // Leaf node or collapsed
  if (visibleChildren.length === 0) {
    return {
      width: w,
      height: NODE_HEIGHT,
      nodes: [{ id: task.id, x: 0, y: 0, width: w, height: NODE_HEIGHT, depth, parentId, task, descendantCount: dc, completedDescendantCount: cc, isAtomicChild: false }],
    };
  }

  // All children are leaves → stack them vertically under parent
  if (areAllChildrenLeaves(task)) {
    const stackStartY = NODE_HEIGHT + PARENT_TO_CHILDREN_GAP;
    const stack = layoutAtomicStack(visibleChildren, task.id, depth + 1, stackStartY, collapsedIds);

    const subtreeWidth = Math.max(w, stack.width);
    const allNodes: LayoutNode[] = [
      { id: task.id, x: 0, y: 0, width: w, height: NODE_HEIGHT, depth, parentId, task, descendantCount: dc, completedDescendantCount: cc, isAtomicChild: false },
      ...stack.nodes,
    ];

    return { width: subtreeWidth, height: stackStartY + stack.height, nodes: allNodes };
  }

  // Mixed children: separate branches (have children) from atomics (leaves)
  const branches = visibleChildren.filter(c => !isLeaf(c));
  const atomics = visibleChildren.filter(c => isLeaf(c));

  // Layout each branch subtree
  const branchResults = branches.map(child => layoutSubtree(child, task.id, depth + 1, collapsedIds));

  // Layout atomic stack if any
  let atomicResult: SubtreeInfo | null = null;
  if (atomics.length > 0) {
    atomicResult = layoutAtomicStack(atomics, task.id, depth + 1, 0, collapsedIds);
  }

  // Compute total width of all columns (branches + optional atomic column)
  const columns: { width: number }[] = [...branchResults];
  if (atomicResult) columns.push(atomicResult);

  const totalColumnsWidth = columns.reduce((sum, c) => sum + c.width, 0)
    + (columns.length - 1) * H_GAP;

  const subtreeWidth = Math.max(w, totalColumnsWidth);

  // Position columns side by side
  const startX = -totalColumnsWidth / 2;
  let offsetX = startX;

  const allNodes: LayoutNode[] = [];
  const childrenY = NODE_HEIGHT + V_GAP;

  for (const br of branchResults) {
    const centerOffset = br.width / 2;
    for (const node of br.nodes) {
      allNodes.push({
        ...node,
        x: node.x + offsetX + centerOffset,
        y: node.y + childrenY,
      });
    }
    offsetX += br.width + H_GAP;
  }

  if (atomicResult) {
    const centerOffset = atomicResult.width / 2;
    for (const node of atomicResult.nodes) {
      allNodes.push({
        ...node,
        x: node.x + offsetX + centerOffset,
        y: node.y + childrenY,
      });
    }
  }

  // Root of this subtree at (0, 0)
  allNodes.unshift({
    id: task.id, x: 0, y: 0, width: w, height: NODE_HEIGHT, depth, parentId, task, descendantCount: dc, completedDescendantCount: cc, isAtomicChild: false,
  });

  // Compute total height
  let maxChildBottom = 0;
  for (const n of allNodes) {
    const bottom = n.y + n.height;
    if (bottom > maxChildBottom) maxChildBottom = bottom;
  }

  return { width: subtreeWidth, height: maxChildBottom, nodes: allNodes };
}

export function layoutTree(root: Task, collapsedIds?: Set<number>, compact?: boolean): LayoutNode[] {
  applySpacing(!!compact);
  const { nodes } = layoutSubtree(root, null, 0, collapsedIds);
  return nodes;
}
