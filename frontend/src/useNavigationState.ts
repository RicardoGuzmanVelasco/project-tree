import { useState, useCallback } from "react";
import { Task } from "./types";

export interface NavigationState {
  collapsedIds: Set<number>;
  depthLevel: number | null;
  hideCompleted: boolean;
  revealedParentIds: Set<number>;
  collapseSubtree: (task: Task) => void;
  toggleCollapse: (task: Task) => void;
  collapseToDepth: (root: Task, depth: number) => void;
  clearDepthLevel: () => void;
  setHideCompleted: (hide: boolean) => void;
  toggleRevealCompleted: (parentId: number) => void;
  reset: () => void;
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

function collectIdsAtOrBeyondDepth(task: Task, targetDepth: number, currentDepth: number): number[] {
  const ids: number[] = [];
  if (currentDepth >= targetDepth && task.children.length > 0) {
    ids.push(task.id);
  }
  for (const child of task.children) {
    ids.push(...collectIdsAtOrBeyondDepth(child, targetDepth, currentDepth + 1));
  }
  return ids;
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

export function useNavigationState(): NavigationState {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [depthLevel, setDepthLevel] = useState<number | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [revealedParentIds, setRevealedParentIds] = useState<Set<number>>(new Set());

  const collapseSubtree = useCallback((task: Task) => {
    setDepthLevel(null);
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
    setDepthLevel(null);
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

  const collapseToDepth = useCallback((root: Task, depth: number) => {
    setDepthLevel(depth);
    const ids = collectIdsAtOrBeyondDepth(root, depth, 0);
    setCollapsedIds(new Set(ids));
  }, []);

  const clearDepthLevel = useCallback(() => {
    setDepthLevel(null);
  }, []);

  const handleSetHideCompleted = useCallback((hide: boolean) => {
    setHideCompleted(hide);
    if (!hide) setRevealedParentIds(new Set());
  }, []);

  const toggleRevealCompleted = useCallback((parentId: number) => {
    setRevealedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setCollapsedIds(new Set());
    setDepthLevel(null);
    setHideCompleted(false);
    setRevealedParentIds(new Set());
  }, []);

  return {
    collapsedIds, depthLevel, hideCompleted, revealedParentIds,
    collapseSubtree, toggleCollapse, collapseToDepth, clearDepthLevel,
    setHideCompleted: handleSetHideCompleted, toggleRevealCompleted, reset,
  };
}
