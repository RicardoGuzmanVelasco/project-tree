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

// --- Plan helpers ---

export function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}
