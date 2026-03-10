import { useState, useCallback } from "react";
import { Task } from "./types";

export interface NavigationState {
  collapsedIds: Set<number>;
  collapseSubtree: (task: Task) => void;
  toggleCollapse: (task: Task) => void;
}

function collectDescendantIdsWithChildren(task: Task): number[] {
  const ids: number[] = [];
  const stack = [...task.children];
  while (stack.length > 0) {
    const t = stack.pop()!;
    if (t.children.length > 0) {
      ids.push(t.id);
      for (const c of t.children) stack.push(c);
    }
  }
  return ids;
}

export function useNavigationState(): NavigationState {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  const collapseSubtree = useCallback((task: Task) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      next.add(task.id);
      for (const id of collectDescendantIdsWithChildren(task)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((task: Task) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
        for (const id of collectDescendantIdsWithChildren(task)) {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  return { collapsedIds, collapseSubtree, toggleCollapse };
}
