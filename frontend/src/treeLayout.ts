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

// Orientation flag — set by layoutTree
let HORIZONTAL = false;
let MINDMAP = false;

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
    if (child.completed || child.abandoned) count++;
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

function makeNode(
  task: Task, depth: number, parentId: number | null,
  x: number, y: number, w: number, h: number, isAtomicChild: boolean,
): LayoutNode {
  return {
    id: task.id, x, y, width: w, height: h, depth, parentId, task,
    descendantCount: countDescendants(task),
    completedDescendantCount: countCompletedDescendants(task),
    isAtomicChild,
  };
}

function collapsedBadgeWidth(cc: number, dc: number): number {
  const label = `${cc}/${dc}`;
  return label.length * 6 + 10 + 16; // badge + padding around it
}

// Layout a vertical stack of leaf nodes.
// Vertical mode: stack below parent at x=0, starting at startY.
// Horizontal mode: stack below parent at startX, starting at y=0.
function layoutAtomicStack(
  tasks: Task[],
  parentId: number,
  depth: number,
  startOffset: number,
  collapsedIds?: Set<number>,
): SubtreeInfo {
  let maxW = 0;
  for (const t of tasks) {
    const w = nodeWidth(t.title);
    if (w > maxW) maxW = w;
  }

  const nodes: LayoutNode[] = [];

  if (HORIZONTAL) {
    // Stack vertically to the right of parent
    let y = 0;
    for (const t of tasks) {
      nodes.push(makeNode(t, depth, parentId, startOffset + maxW / 2, y, maxW, ATOMIC_NODE_HEIGHT, true));
      y += ATOMIC_NODE_HEIGHT + ATOMIC_V_GAP;
    }
    const totalHeight = y - ATOMIC_V_GAP;
    return { width: startOffset + maxW, height: totalHeight, nodes };
  }

  // Vertical: stack below parent at x=0
  let y = startOffset;
  for (const t of tasks) {
    nodes.push(makeNode(t, depth, parentId, 0, y, maxW, ATOMIC_NODE_HEIGHT, true));
    y += ATOMIC_NODE_HEIGHT + ATOMIC_V_GAP;
  }
  const totalHeight = y - startOffset - ATOMIC_V_GAP;
  return { width: maxW, height: totalHeight, nodes };
}

function layoutSubtree(task: Task, parentId: number | null, depth: number, collapsedIds?: Set<number>): SubtreeInfo {
  const dc = countDescendants(task);
  const cc = countCompletedDescendants(task);
  const isCollapsed = collapsedIds?.has(task.id);
  const baseW = nodeWidth(task.title);
  const w = dc > 0 ? Math.max(baseW, baseW + collapsedBadgeWidth(cc, dc) - NODE_PADDING_X) : baseW;
  const visibleChildren = (!isCollapsed && task.children.length > 0) ? task.children : [];

  const rootNode = makeNode(task, depth, parentId, 0, 0, w, NODE_HEIGHT, false);

  // Leaf node or collapsed
  if (visibleChildren.length === 0) {
    return { width: w, height: NODE_HEIGHT, nodes: [rootNode] };
  }

  if (HORIZONTAL) {
    return layoutSubtreeHorizontal(task, rootNode, w, depth, visibleChildren, collapsedIds);
  }
  return layoutSubtreeVertical(task, rootNode, w, depth, visibleChildren, collapsedIds);
}

// Vertical layout: children below, siblings spread horizontally
function layoutSubtreeVertical(
  task: Task, rootNode: LayoutNode, w: number, depth: number,
  visibleChildren: Task[], collapsedIds?: Set<number>,
): SubtreeInfo {
  // All children are leaves → stack them vertically under parent
  if (areAllChildrenLeaves(task)) {
    const stackStartY = NODE_HEIGHT + PARENT_TO_CHILDREN_GAP;
    const stack = layoutAtomicStack(visibleChildren, task.id, depth + 1, stackStartY, collapsedIds);
    const subtreeWidth = Math.max(w, stack.width);
    return { width: subtreeWidth, height: stackStartY + stack.height, nodes: [rootNode, ...stack.nodes] };
  }

  // Mixed children: separate branches from atomics
  const branches = visibleChildren.filter(c => !isLeaf(c));
  const atomics = visibleChildren.filter(c => isLeaf(c));

  const branchResults = branches.map(child => layoutSubtree(child, task.id, depth + 1, collapsedIds));

  let atomicResult: SubtreeInfo | null = null;
  if (atomics.length > 0) {
    atomicResult = layoutAtomicStack(atomics, task.id, depth + 1, 0, collapsedIds);
  }

  // Columns: branches + optional atomic column
  const columns: SubtreeInfo[] = [...branchResults];
  if (atomicResult) columns.push(atomicResult);

  const totalColumnsWidth = columns.reduce((sum, c) => sum + c.width, 0)
    + (columns.length - 1) * H_GAP;
  const subtreeWidth = Math.max(w, totalColumnsWidth);

  // Position columns side by side horizontally
  const startX = -totalColumnsWidth / 2;
  let offsetX = startX;
  const childrenY = NODE_HEIGHT + V_GAP;
  const allNodes: LayoutNode[] = [];

  for (const col of columns) {
    const centerOffset = col.width / 2;
    for (const node of col.nodes) {
      allNodes.push({ ...node, x: node.x + offsetX + centerOffset, y: node.y + childrenY });
    }
    offsetX += col.width + H_GAP;
  }

  allNodes.unshift(rootNode);

  let maxChildBottom = 0;
  for (const n of allNodes) {
    const bottom = n.y + n.height;
    if (bottom > maxChildBottom) maxChildBottom = bottom;
  }

  return { width: subtreeWidth, height: maxChildBottom, nodes: allNodes };
}

// Horizontal layout: children to the right, siblings spread vertically
function layoutSubtreeHorizontal(
  task: Task, rootNode: LayoutNode, w: number, depth: number,
  visibleChildren: Task[], collapsedIds?: Set<number>,
): SubtreeInfo {
  // All children are leaves → stack them vertically to the right
  if (areAllChildrenLeaves(task)) {
    const stackStartX = w / 2 + PARENT_TO_CHILDREN_GAP;
    const stack = layoutAtomicStack(visibleChildren, task.id, depth + 1, stackStartX, collapsedIds);

    // Center parent and stack vertically relative to each other
    const subtreeHeight = Math.max(NODE_HEIGHT, stack.height);
    const rootY = (subtreeHeight - NODE_HEIGHT) / 2;
    const stackYOffset = (subtreeHeight - stack.height) / 2;

    return {
      width: stack.width,
      height: subtreeHeight,
      nodes: [
        { ...rootNode, y: rootY },
        ...stack.nodes.map(n => ({ ...n, y: n.y + stackYOffset })),
      ],
    };
  }

  // Mixed children: separate branches from atomics
  const branches = visibleChildren.filter(c => !isLeaf(c));
  const atomics = visibleChildren.filter(c => isLeaf(c));

  const branchResults = branches.map(child => layoutSubtree(child, task.id, depth + 1, collapsedIds));

  let atomicResult: SubtreeInfo | null = null;
  if (atomics.length > 0) {
    const stackStartX = 0; // will be offset by childrenX later
    atomicResult = layoutAtomicStack(atomics, task.id, depth + 1, stackStartX, collapsedIds);
  }

  // Rows: branches + optional atomic row
  const rows: SubtreeInfo[] = [...branchResults];
  if (atomicResult) rows.push(atomicResult);

  const totalRowsHeight = rows.reduce((sum, r) => sum + r.height, 0)
    + (rows.length - 1) * H_GAP;

  // Position rows stacked vertically, centered around y = NODE_HEIGHT/2
  const startY = NODE_HEIGHT / 2 - totalRowsHeight / 2;
  let offsetY = startY;
  const childrenX = w / 2 + V_GAP;
  const allNodes: LayoutNode[] = [];

  for (const row of rows) {
    for (const node of row.nodes) {
      allNodes.push({ ...node, x: node.x + childrenX, y: node.y + offsetY });
    }
    offsetY += row.height + H_GAP;
  }

  allNodes.unshift(rootNode);

  // Compute bounds
  let minTop = 0, maxBottom = NODE_HEIGHT;
  for (const n of allNodes) {
    if (n.y < minTop) minTop = n.y;
    const bottom = n.y + n.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  let maxRight = w;
  for (const n of allNodes) {
    const right = n.x + n.width / 2;
    if (right > maxRight) maxRight = right;
  }

  // Normalize: shift everything so minTop = 0
  if (minTop < 0) {
    for (const n of allNodes) n.y -= minTop;
    maxBottom -= minTop;
  }

  return { width: maxRight, height: maxBottom, nodes: allNodes };
}

// Mindmap root layout: split children into two halves, one above/left and one below/right
function layoutMindmapRoot(task: Task, collapsedIds?: Set<number>): SubtreeInfo {
  const dc = countDescendants(task);
  const cc = countCompletedDescendants(task);
  const baseW = nodeWidth(task.title);
  const w = dc > 0 ? Math.max(baseW, baseW + collapsedBadgeWidth(cc, dc) - NODE_PADDING_X) : baseW;
  const isCollapsed = collapsedIds?.has(task.id);
  const visibleChildren = (!isCollapsed && task.children.length > 0) ? task.children : [];

  const rootNode = makeNode(task, 0, null, 0, 0, w, NODE_HEIGHT, false);

  if (visibleChildren.length === 0) {
    return { width: w, height: NODE_HEIGHT, nodes: [rootNode] };
  }

  // Split children: first half goes "up/left", second half goes "down/right"
  const mid = Math.ceil(visibleChildren.length / 2);
  const topChildren = visibleChildren.slice(0, mid);
  const bottomChildren = visibleChildren.slice(mid);

  if (HORIZONTAL) {
    return layoutMindmapHorizontal(task, rootNode, w, topChildren, bottomChildren, collapsedIds);
  }
  return layoutMindmapVertical(task, rootNode, w, topChildren, bottomChildren, collapsedIds);
}

function layoutMindmapVertical(
  task: Task, rootNode: LayoutNode, w: number,
  topChildren: Task[], bottomChildren: Task[],
  collapsedIds?: Set<number>,
): SubtreeInfo {
  const allNodes: LayoutNode[] = [rootNode];

  // Layout bottom half (normal vertical layout, below root)
  const bottomResults = bottomChildren.map(child => layoutSubtree(child, task.id, 1, collapsedIds));
  if (bottomResults.length > 0) {
    const totalW = bottomResults.reduce((sum, r) => sum + r.width, 0) + (bottomResults.length - 1) * H_GAP;
    let offsetX = -totalW / 2;
    const childrenY = NODE_HEIGHT + V_GAP;
    for (const col of bottomResults) {
      const cx = offsetX + col.width / 2;
      for (const node of col.nodes) {
        allNodes.push({ ...node, x: node.x + cx, y: node.y + childrenY });
      }
      offsetX += col.width + H_GAP;
    }
  }

  // Layout top half (inverted: grows upward from root)
  const topResults = topChildren.map(child => layoutSubtree(child, task.id, 1, collapsedIds));
  if (topResults.length > 0) {
    const totalW = topResults.reduce((sum, r) => sum + r.width, 0) + (topResults.length - 1) * H_GAP;
    let offsetX = -totalW / 2;
    for (const col of topResults) {
      const cx = offsetX + col.width / 2;
      // Mirror vertically: flip y so subtree grows upward from root top edge
      for (const node of col.nodes) {
        allNodes.push({
          ...node,
          x: node.x + cx,
          y: -(node.y + node.height) - V_GAP,
        });
      }
      offsetX += col.width + H_GAP;
    }
  }

  // Compute bounds
  let minY = 0, maxY = NODE_HEIGHT;
  for (const n of allNodes) {
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return { width: w, height: maxY - minY, nodes: allNodes };
}

function layoutMindmapHorizontal(
  task: Task, rootNode: LayoutNode, w: number,
  leftChildren: Task[], rightChildren: Task[],
  collapsedIds?: Set<number>,
): SubtreeInfo {
  const allNodes: LayoutNode[] = [rootNode];

  // Right half (normal horizontal layout)
  const rightResults = rightChildren.map(child => layoutSubtree(child, task.id, 1, collapsedIds));
  if (rightResults.length > 0) {
    const totalH = rightResults.reduce((sum, r) => sum + r.height, 0) + (rightResults.length - 1) * H_GAP;
    let offsetY = NODE_HEIGHT / 2 - totalH / 2;
    const childrenX = w / 2 + V_GAP;
    for (const row of rightResults) {
      for (const node of row.nodes) {
        allNodes.push({ ...node, x: node.x + childrenX, y: node.y + offsetY });
      }
      offsetY += row.height + H_GAP;
    }
  }

  // Left half (mirrored: grows leftward from root)
  const leftResults = leftChildren.map(child => layoutSubtree(child, task.id, 1, collapsedIds));
  if (leftResults.length > 0) {
    const totalH = leftResults.reduce((sum, r) => sum + r.height, 0) + (leftResults.length - 1) * H_GAP;
    let offsetY = NODE_HEIGHT / 2 - totalH / 2;
    for (const row of leftResults) {
      // Find the rightmost edge of the subtree to know total width
      let maxRight = 0;
      for (const node of row.nodes) {
        const right = node.x + node.width / 2;
        if (right > maxRight) maxRight = right;
      }
      // Mirror horizontally: flip x so subtree grows leftward from root
      for (const node of row.nodes) {
        allNodes.push({
          ...node,
          x: -(maxRight - node.x) - V_GAP - w / 2,
          y: node.y + offsetY,
        });
      }
      offsetY += row.height + H_GAP;
    }
  }

  // Normalize
  let minX = 0, maxX = w, minY = 0, maxY = NODE_HEIGHT;
  for (const n of allNodes) {
    const left = n.x - n.width / 2;
    const right = n.x + n.width / 2;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return { width: maxX - minX, height: maxY - minY, nodes: allNodes };
}

export type Orientation = "vertical" | "horizontal";

export function layoutTree(root: Task, collapsedIds?: Set<number>, compact?: boolean, orientation?: Orientation, mindmap?: boolean): LayoutNode[] {
  applySpacing(!!compact);
  HORIZONTAL = orientation === "horizontal";
  MINDMAP = !!mindmap;
  if (MINDMAP) {
    const { nodes } = layoutMindmapRoot(root, collapsedIds);
    return nodes;
  }
  const { nodes } = layoutSubtree(root, null, 0, collapsedIds);
  return nodes;
}
