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
  suggestPrunes,
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

// --- suggestPrunes ---

function done(id: number, kids: Task[] = []): Task {
  return { id, title: `T${id}`, completed: true, children: kids };
}
function open(id: number, kids: Task[] = []): Task {
  return { id, title: `T${id}`, completed: false, children: kids };
}

describe("suggestPrunes", () => {
  const OPTS = { minRatio: 0.8, minSize: 3 };

  it("excludes the root even if it qualifies", () => {
    const root = open(1, [done(2), done(3), done(4)]);
    const out = suggestPrunes(root, OPTS);
    expect(out.find(s => s.id === 1)).toBeUndefined();
  });

  it("excludes leaves (no children)", () => {
    const root = open(1, [done(2)]);
    const out = suggestPrunes(root, { minRatio: 1, minSize: 0 });
    expect(out).toEqual([]);
  });

  it("filters by minSize on total descendants", () => {
    const small = open(2, [done(3), done(4)]);              // total=2
    const big = open(5, [done(6), done(7), done(8), done(9)]); // total=4
    const root = open(1, [small, big]);
    const out = suggestPrunes(root, { minRatio: 0.5, minSize: 3 });
    expect(out.map(s => s.id)).toEqual([5]);
  });

  it("filters by minRatio", () => {
    // hub has 4 descendants, 3 closed -> ratio 0.75
    const hub = open(2, [done(3), done(4), done(5), open(6)]);
    const root = open(1, [hub]);
    const at80 = suggestPrunes(root, { minRatio: 0.8, minSize: 1 });
    expect(at80.map(s => s.id)).not.toContain(2);
    const at50 = suggestPrunes(root, { minRatio: 0.5, minSize: 1 });
    expect(at50.map(s => s.id)).toContain(2);
  });

  it("ranks by ratio desc, then total desc", () => {
    // hub A: 5 descendants, 5 closed (ratio 1.0)
    const a = open(10, [done(11), done(12), done(13), done(14), done(15)]);
    // hub B: 10 descendants, 9 closed (ratio 0.9)
    const b = open(20, [done(21), done(22), done(23), done(24), done(25), done(26), done(27), done(28), done(29), open(30)]);
    // hub C: 4 descendants, 4 closed (ratio 1.0)
    const c = open(40, [done(41), done(42), done(43), done(44)]);
    const root = open(1, [a, b, c]);
    const out = suggestPrunes(root, { minRatio: 0.8, minSize: 3 });
    expect(out.map(s => s.id)).toEqual([10, 40, 20]);
  });

  it("links nested suggestions to their nearest candidate ancestor", () => {
    // outer hub qualifies; inner hub also qualifies and lives under outer
    const inner = open(20, [done(21), done(22), done(23)]);
    const outer = open(10, [inner, done(11), done(12)]);
    const root = open(1, [outer]);
    const out = suggestPrunes(root, { minRatio: 0.8, minSize: 3 });
    const outerSug = out.find(s => s.id === 10)!;
    const innerSug = out.find(s => s.id === 20)!;
    expect(outerSug.parentSuggestionId).toBeUndefined();
    expect(innerSug.parentSuggestionId).toBe(10);
  });

  it("counts abandoned as closed", () => {
    const hub = open(2, [
      { id: 3, title: "a", completed: false, abandoned: true, children: [] },
      done(4),
      done(5),
    ]);
    const root = open(1, [hub]);
    const out = suggestPrunes(root, { minRatio: 1, minSize: 3 });
    expect(out.map(s => s.id)).toEqual([2]);
  });
});
