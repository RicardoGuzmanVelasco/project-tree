import { describe, it, expect } from "vitest";
import { computePlanProgress } from "./planProgress";
import { Task, Plan } from "./types";

function task(id: number, overrides: Partial<Task> = {}): Task {
  return { id, title: `Task ${id}`, completed: false, children: [], ...overrides };
}

describe("computePlanProgress", () => {
  it("counts completed and abandoned tasks", () => {
    const tree = task(-1, {
      children: [
        task(1, { completed: true }),
        task(2, { abandoned: true }),
        task(3),
      ],
    });
    const plan: Plan = { id: 1, name: "test", taskIds: [1, 2, 3] };
    const progress = computePlanProgress(tree, plan);
    expect(progress).toEqual({ completed: 2, total: 3 });
  });

  it("ignores plan task IDs that no longer exist in the tree", () => {
    // Task 99 was deleted from the tree but still referenced in the plan
    const tree = task(-1, {
      children: [
        task(1, { completed: true }),
        task(2),
      ],
    });
    const plan: Plan = { id: 1, name: "test", taskIds: [1, 2, 99] };
    const progress = computePlanProgress(tree, plan);

    // total should be 2 (only tasks that exist), not 3
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
  });

  it("returns zero progress for a plan whose tasks were all deleted", () => {
    const tree = task(-1, { children: [] });
    const plan: Plan = { id: 1, name: "ghost plan", taskIds: [10, 20, 30] };
    const progress = computePlanProgress(tree, plan);

    expect(progress).toEqual({ completed: 0, total: 0 });
  });
});
