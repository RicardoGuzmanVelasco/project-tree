import { describe, it, expect } from "vitest";
import { Task, Plan } from "./types";
import {
  ensureCompleted,
  findTask,
  findParent,
  maxId,
  countNodes,
  countDescendants,
  countCompletedDescendants,
  computeMaxDepth,
  collectDescendantIds,
  isPrunable,
  formatPrunedTree,
  nextPlanId,
} from "./tree-ops";

function task(id: number, overrides: Partial<Task> = {}): Task {
  return { id, title: `Task ${id}`, completed: false, children: [], ...overrides };
}

// --- ensureCompleted ---

describe("ensureCompleted", () => {
  it("sets completed to false when missing", () => {
    const input = { id: 1, title: "root", children: [] } as any;
    const result = ensureCompleted(input);
    expect(result.completed).toBe(false);
  });

  it("preserves existing completed value", () => {
    const result = ensureCompleted(task(1, { completed: true }));
    expect(result.completed).toBe(true);
  });

  it("applies recursively to children", () => {
    const input = {
      id: 1, title: "root", completed: true,
      children: [{ id: 2, title: "child", children: [] } as any],
    } as Task;
    const result = ensureCompleted(input);
    expect(result.children[0].completed).toBe(false);
  });
});

// --- findTask ---

describe("findTask", () => {
  const tree = task(1, {
    children: [
      task(2, { children: [task(4), task(5)] }),
      task(3),
    ],
  });

  it("finds root", () => {
    expect(findTask(tree, 1)?.id).toBe(1);
  });

  it("finds deeply nested task", () => {
    expect(findTask(tree, 5)?.id).toBe(5);
  });

  it("returns null for non-existent id", () => {
    expect(findTask(tree, 99)).toBeNull();
  });
});

// --- findParent ---

describe("findParent", () => {
  const tree = task(1, {
    children: [
      task(2, { children: [task(4)] }),
      task(3),
    ],
  });

  it("finds parent of a direct child", () => {
    expect(findParent(tree, 2)?.id).toBe(1);
  });

  it("finds parent of a nested child", () => {
    expect(findParent(tree, 4)?.id).toBe(2);
  });

  it("returns null for root (has no parent)", () => {
    expect(findParent(tree, 1)).toBeNull();
  });

  it("returns null for non-existent id", () => {
    expect(findParent(tree, 99)).toBeNull();
  });
});

// --- maxId ---

describe("maxId", () => {
  it("returns the only id for a leaf", () => {
    expect(maxId(task(42))).toBe(42);
  });

  it("returns the highest id across the tree", () => {
    const tree = task(1, {
      children: [task(10, { children: [task(5)] }), task(3)],
    });
    expect(maxId(tree)).toBe(10);
  });
});

// --- countNodes ---

describe("countNodes", () => {
  it("counts a single node", () => {
    expect(countNodes(task(1))).toBe(1);
  });

  it("counts all nodes recursively", () => {
    const tree = task(1, {
      children: [task(2, { children: [task(3)] }), task(4)],
    });
    expect(countNodes(tree)).toBe(4);
  });
});

// --- countDescendants ---

describe("countDescendants", () => {
  it("returns 0 for a leaf", () => {
    expect(countDescendants(task(1))).toBe(0);
  });

  it("counts only descendants, not the node itself", () => {
    const tree = task(1, {
      children: [task(2, { children: [task(3)] }), task(4)],
    });
    expect(countDescendants(tree)).toBe(3);
  });
});

// --- countCompletedDescendants ---

describe("countCompletedDescendants", () => {
  it("returns 0 when no descendants are completed", () => {
    const tree = task(1, { children: [task(2), task(3)] });
    expect(countCompletedDescendants(tree)).toBe(0);
  });

  it("counts completed descendants", () => {
    const tree = task(1, {
      children: [
        task(2, { completed: true }),
        task(3),
        task(4, { completed: true }),
      ],
    });
    expect(countCompletedDescendants(tree)).toBe(2);
  });

  it("counts abandoned as completed", () => {
    const tree = task(1, {
      children: [task(2, { abandoned: true })],
    });
    expect(countCompletedDescendants(tree)).toBe(1);
  });

  it("counts recursively through nested children", () => {
    const tree = task(1, {
      children: [
        task(2, { children: [task(3, { completed: true })] }),
      ],
    });
    expect(countCompletedDescendants(tree)).toBe(1);
  });
});

// --- computeMaxDepth ---

describe("computeMaxDepth", () => {
  it("returns 0 for a leaf", () => {
    expect(computeMaxDepth(task(1))).toBe(0);
  });

  it("returns 1 for one level of children", () => {
    const tree = task(1, { children: [task(2), task(3)] });
    expect(computeMaxDepth(tree)).toBe(1);
  });

  it("returns the deepest branch depth", () => {
    const tree = task(1, {
      children: [
        task(2, { children: [task(3, { children: [task(4)] })] }),
        task(5),
      ],
    });
    expect(computeMaxDepth(tree)).toBe(3);
  });
});

// --- isPrunable ---

describe("isPrunable", () => {
  it("returns false for a pending task", () => {
    expect(isPrunable(task(1))).toBe(false);
  });

  it("returns true for a completed leaf", () => {
    expect(isPrunable(task(1, { completed: true }))).toBe(true);
  });

  it("returns true for an abandoned leaf", () => {
    expect(isPrunable(task(1, { abandoned: true }))).toBe(true);
  });

  it("returns true when all children are also prunable", () => {
    const t = task(1, {
      completed: true,
      children: [task(2, { completed: true }), task(3, { abandoned: true })],
    });
    expect(isPrunable(t)).toBe(true);
  });

  it("returns false if any child is pending", () => {
    const t = task(1, {
      completed: true,
      children: [task(2, { completed: true }), task(3)],
    });
    expect(isPrunable(t)).toBe(false);
  });
});

// --- formatPrunedTree ---

describe("formatPrunedTree", () => {
  it("formats a single task", () => {
    expect(formatPrunedTree(task(1, { title: "Done" }))).toBe("- Done\n");
  });

  it("marks abandoned tasks", () => {
    expect(formatPrunedTree(task(1, { title: "Nope", abandoned: true }))).toBe("- Nope [abandoned]\n");
  });

  it("indents children", () => {
    const t = task(1, {
      title: "Parent",
      children: [task(2, { title: "Child" })],
    });
    expect(formatPrunedTree(t)).toBe("- Parent\n  - Child\n");
  });
});

// --- collectDescendantIds ---

describe("collectDescendantIds", () => {
  it("returns empty array for a leaf", () => {
    expect(collectDescendantIds(task(1))).toEqual([]);
  });

  it("collects direct children", () => {
    const t = task(1, { children: [task(2), task(3)] });
    expect(collectDescendantIds(t)).toEqual([2, 3]);
  });

  it("collects nested descendants depth-first", () => {
    const t = task(1, {
      children: [
        task(2, { children: [task(4), task(5)] }),
        task(3),
      ],
    });
    expect(collectDescendantIds(t)).toEqual([2, 4, 5, 3]);
  });

  it("does not include the root task itself", () => {
    const t = task(10, { children: [task(20)] });
    expect(collectDescendantIds(t)).not.toContain(10);
  });
});

// --- nextPlanId ---

describe("nextPlanId", () => {
  it("returns 1 for an empty array", () => {
    expect(nextPlanId([])).toBe(1);
  });

  it("returns max id + 1", () => {
    const plans: Plan[] = [
      { id: 3, name: "a", taskIds: [] },
      { id: 7, name: "b", taskIds: [] },
    ];
    expect(nextPlanId(plans)).toBe(8);
  });
});
