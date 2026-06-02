import { Task, Plan } from "./types";

export interface PlanProgress {
  completed: number;
  total: number;
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
