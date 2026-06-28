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
  parentSuggestionId?: number;
}

export interface SuggestOptions {
  minRatio: number;
  minSize: number;
}

export function suggestPrunes(root: Task, opts: SuggestOptions): PruneSuggestion[] {
  const out: PruneSuggestion[] = [];
  visit(root, true, undefined);
  out.sort((a, b) => b.ratio - a.ratio || b.total - a.total);
  return out;

  function visit(node: Task, isRoot: boolean, ancestorId: number | undefined) {
    let nextAncestorId = ancestorId;
    const total = countDescendants(node);
    if (!isRoot && node.children.length > 0 && total >= opts.minSize) {
      const closed = countCompletedDescendants(node);
      const ratio = closed / total;
      if (ratio >= opts.minRatio) {
        const suggestion: PruneSuggestion = { id: node.id, title: node.title, closed, total, ratio };
        if (ancestorId !== undefined) suggestion.parentSuggestionId = ancestorId;
        out.push(suggestion);
        nextAncestorId = node.id;
      }
    }
    for (const child of node.children) visit(child, false, nextAncestorId);
  }
}

// --- Plan helpers ---

export function nextPlanId(plans: Plan[]): number {
  return plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1;
}

// --- Health: diagnose & repair ---

export interface DuplicateIdIssue {
  type: "duplicate_id";
  id: number;
  occurrences: { title: string; path: string }[];
}

export interface BrokenPlanRefIssue {
  type: "broken_plan_ref";
  planName: string;
  taskId: number;
}

export type HealthIssue = DuplicateIdIssue | BrokenPlanRefIssue;

export interface DiagnoseResult {
  issues: DuplicateIdIssue[];
}

export function diagnose(tree: Task): DiagnoseResult {
  const nodes: { id: number; title: string; path: string }[] = [];

  function walk(node: Task, parentPath: string) {
    const p = parentPath ? `${parentPath} > ${node.title}` : node.title;
    nodes.push({ id: node.id, title: node.title, path: p });
    node.children.forEach(c => walk(c, p));
  }
  walk(tree, "");

  const byId = new Map<number, { title: string; path: string }[]>();
  for (const { id, title, path } of nodes) {
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push({ title, path });
  }

  const issues: DuplicateIdIssue[] = [];
  for (const [id, occurrences] of byId.entries()) {
    if (occurrences.length > 1) {
      issues.push({ type: "duplicate_id", id, occurrences });
    }
  }

  return { issues };
}

export interface RepairRename {
  from: number;
  to: number;
  title: string;
}

export interface RepairResult {
  renames: RepairRename[];
}

export function repairTree(tree: Task): { tree: Task; result: RepairResult } {
  const seen = new Set<number>();
  const renames: RepairRename[] = [];
  let nextNewId = maxId(tree) + 1;

  function fixNode(node: Task): Task {
    let id = node.id;
    if (seen.has(id)) {
      renames.push({ from: id, to: nextNewId, title: node.title });
      id = nextNewId++;
    } else {
      seen.add(node.id);
    }
    return { ...node, id, children: node.children.map(fixNode) };
  }

  return { tree: fixNode(tree), result: { renames } };
}
