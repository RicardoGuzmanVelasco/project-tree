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
}

const NODE_HEIGHT = 36;
const NODE_PADDING_X = 24;
const CHAR_WIDTH = 8;
const MIN_NODE_WIDTH = 60;
const H_GAP = 20;
const V_GAP = 60;

function nodeWidth(title: string): number {
  return Math.max(MIN_NODE_WIDTH, title.length * CHAR_WIDTH + NODE_PADDING_X * 2);
}

interface SubtreeInfo {
  width: number;
  nodes: LayoutNode[];
}

function layoutSubtree(task: Task, parentId: number | null, depth: number, collapsedIds?: Set<number>): SubtreeInfo {
  const w = nodeWidth(task.title);
  const isCollapsed = collapsedIds?.has(task.id);
  const visibleChildren = (!isCollapsed && task.children.length > 0) ? task.children : [];

  if (visibleChildren.length === 0) {
    return {
      width: w,
      nodes: [{ id: task.id, x: 0, y: 0, width: w, height: NODE_HEIGHT, depth, parentId, task }],
    };
  }

  // Layout each child subtree
  const childResults = visibleChildren.map(child => layoutSubtree(child, task.id, depth + 1, collapsedIds));

  // Total width of all children with gaps
  const totalChildrenWidth = childResults.reduce((sum, cr) => sum + cr.width, 0)
    + (childResults.length - 1) * H_GAP;

  // The subtree width is the max of this node's width and the children span
  const subtreeWidth = Math.max(w, totalChildrenWidth);

  // Position children side by side, centered under the parent
  const childrenStartX = -totalChildrenWidth / 2;
  let offsetX = childrenStartX;

  const allNodes: LayoutNode[] = [];

  for (const cr of childResults) {
    const childCenterOffset = cr.width / 2;
    for (const node of cr.nodes) {
      allNodes.push({
        ...node,
        x: node.x + offsetX + childCenterOffset,
        y: node.y + NODE_HEIGHT + V_GAP,
      });
    }
    offsetX += cr.width + H_GAP;
  }

  // Root of this subtree at (0, 0)
  allNodes.unshift({ id: task.id, x: 0, y: 0, width: w, height: NODE_HEIGHT, depth, parentId, task });

  return { width: subtreeWidth, nodes: allNodes };
}

export function layoutTree(root: Task, collapsedIds?: Set<number>): LayoutNode[] {
  const { nodes } = layoutSubtree(root, null, 0, collapsedIds);
  return nodes;
}
