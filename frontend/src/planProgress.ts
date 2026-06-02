import { Task, Plan } from "./types";

export interface PlanProgress {
  completed: number;
  total: number;
}

export function isPlanComplete(progress: PlanProgress, plan: Plan): boolean {
  if (progress.total === 0) return plan.taskIds.length > 0; // all ghost → complete
  return progress.completed === progress.total;
}

export function computePlanProgress(tree: Task, plan: Plan): PlanProgress {
  let total = 0;
  let completed = 0;
  const check = (node: Task) => {
    if (plan.taskIds.includes(node.id)) {
      total++;
      if (node.completed || node.abandoned) completed++;
    }
    node.children.forEach(check);
  };
  check(tree);
  return { completed, total };
}
