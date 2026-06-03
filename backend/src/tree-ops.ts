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

// --- Prune helpers ---

export function isPrunable(task: Task): boolean {
  if (!task.completed && !task.abandoned) return false;
  return task.children.every(isPrunable);
}

export function formatPrunedTree(task: Task, indent: number = 0): string {
  const prefix = "  ".repeat(indent) + "- ";
  const status = task.abandoned ? " [abandoned]" : "";
  let result = prefix + task.title + status + "\n";
  for (const child of task.children) {
    result += formatPrunedTree(child, indent + 1);
  }
  return result;
}

// --- Plan helpers ---

export function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}
