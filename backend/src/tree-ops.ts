import { Task, Plan } from "./types";

// --- Tree operations (pure, no I/O) ---

export function ensureCompleted(node: Task): Task {
  return {
    ...node,
    completed: node.completed ?? false,
    children: node.children.map(ensureCompleted),
  };
}

export function findTask(node: Task, id: number): Task | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findTask(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(node: Task, taskId: number): Task | null {
  for (const child of node.children) {
    if (child.id === taskId) return node;
    const found = findParent(child, taskId);
    if (found) return found;
  }
  return null;
}

export function maxId(node: Task): number {
  return Math.max(node.id, ...node.children.map(maxId));
}

export function countNodes(task: Task): number {
  return 1 + task.children.reduce((sum, c) => sum + countNodes(c), 0);
}

// --- Descendant counting ---

export function countDescendants(task: Task): number {
  let count = task.children.length;
  for (const child of task.children) count += countDescendants(child);
  return count;
}

export function countCompletedDescendants(task: Task): number {
  let count = 0;
  for (const child of task.children) {
    if (child.completed || child.abandoned) count++;
    count += countCompletedDescendants(child);
  }
  return count;
}

export function computeMaxDepth(task: Task, current: number = 0): number {
  if (task.children.length === 0) return current;
  let max = current;
  for (const child of task.children) {
    const d = computeMaxDepth(child, current + 1);
    if (d > max) max = d;
  }
  return max;
}

export function collectDescendantIds(task: Task): number[] {
  const ids: number[] = [];
  for (const child of task.children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

// --- Prune suggestions ---

export interface PruneSuggestion {
  id: number;
  title: string;
  closed: number;
  total: number;
  ratio: number;
}

export interface SuggestOptions {
  minRatio: number;
  minSize: number;
}

export function suggestPrunes(root: Task, opts: SuggestOptions): PruneSuggestion[] {
  const out: PruneSuggestion[] = [];
  visit(root, true);
  out.sort((a, b) => b.ratio - a.ratio || b.total - a.total);
  return out;

  function visit(node: Task, isRoot: boolean) {
    const total = countDescendants(node);
    if (!isRoot && node.children.length > 0 && total >= opts.minSize) {
      const closed = countCompletedDescendants(node);
      const ratio = closed / total;
      if (ratio >= opts.minRatio) {
        out.push({ id: node.id, title: node.title, closed, total, ratio });
      }
    }
    for (const child of node.children) visit(child, false);
  }
}

// --- Plan helpers ---

export function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}
