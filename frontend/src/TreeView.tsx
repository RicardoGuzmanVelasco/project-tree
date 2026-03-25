import { ReactNode } from "react";
import { Task } from "./types";
import { NavigationState } from "./useNavigationState";

function ConnectedList<T extends { key: number }>({ items, renderItem }: { items: T[]; renderItem: (item: T, index: number) => ReactNode }) {
  return (
    <div>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={item.key} style={{ display: "flex", position: "relative", paddingLeft: 14 }}>
            <div style={{
              position: "absolute", left: 0, top: 0,
              bottom: isLast ? "50%" : 0,
              width: 2, background: "#555",
            }} />
            <div style={{
              position: "absolute", left: 0, top: "50%",
              width: 14, height: 2, background: "#555",
              marginTop: -1,
            }} />
            {renderItem(item, i)}
          </div>
        );
      })}
    </div>
  );
}

function areAllChildrenLeaves(task: Task): boolean {
  return task.children.length > 0 && task.children.every(c => c.children.length === 0);
}

function isDescendant(task: Task, targetId: number): boolean {
  if (task.id === targetId) return true;
  return task.children.some(c => isDescendant(c, targetId));
}

function countDescendants(task: Task): number {
  let count = task.children.length;
  for (const child of task.children) count += countDescendants(child);
  return count;
}

function countCompletedDescendants(task: Task): number {
  let count = 0;
  for (const child of task.children) {
    if (child.completed) count++;
    count += countCompletedDescendants(child);
  }
  return count;
}

interface TaskNodeProps {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
  relocatingSubtree: Task | null;
  navigation: NavigationState;
  showIds: boolean;
  planTaskIds?: Set<number> | null;
  editingPlanTaskIds?: Set<number> | null;
}

function TaskNode({ task, selectedTaskId, onSelectTask, onToggleCompleted, relocatingTaskId, relocatingSubtree, navigation, showIds, planTaskIds, editingPlanTaskIds }: TaskNodeProps) {
  const isAncestorContext = planTaskIds != null && !planTaskIds.has(task.id);
  const isInEditPlan = editingPlanTaskIds != null && editingPlanTaskIds.has(task.id);
  const isSelected = task.id === selectedTaskId;
  const isRelocating = relocatingTaskId !== null;
  const isInvalidTarget = isRelocating && relocatingSubtree !== null && isDescendant(relocatingSubtree, task.id);
  const isValidTarget = isRelocating && !isInvalidTarget;
  const isCollapsed = navigation.collapsedIds.has(task.id);
  const descendantCount = countDescendants(task);
  const completedDescendantCount = countCompletedDescendants(task);
  const { hideCompleted, revealedParentIds } = navigation;

  const allChildren = isCollapsed ? [] : task.children;
  const hiddenCompletedCount = hideCompleted && !revealedParentIds.has(task.id)
    ? allChildren.filter(c => c.completed).length
    : 0;
  const visibleChildren = hiddenCompletedCount > 0
    ? allChildren.filter(c => !c.completed)
    : allChildren;

  const nodeOpacity = isAncestorContext ? 0.2 : task.completed ? 0.5 : isInvalidTarget ? 0.3 : 1;
  const nodeCursor = isAncestorContext ? "default" : isInvalidTarget ? "not-allowed" : isValidTarget ? "copy" : "pointer";

  const handleClick = () => {
    if (isAncestorContext || isInvalidTarget) return;
    onSelectTask(task.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          border: `2px solid ${isValidTarget ? "#16a34a" : isInEditPlan ? "#16a34a" : isSelected ? "#2563eb" : "#555"}`,
          borderRadius: 6,
          background: isValidTarget ? "#dcfce7" : isInEditPlan ? "#f0fdf4" : isSelected ? "#dbeafe" : "#fff",
          fontSize: 14,
          whiteSpace: "nowrap",
          cursor: nodeCursor,
          opacity: nodeOpacity,
        }}
        onClick={handleClick}
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => { if (!isAncestorContext) onToggleCompleted(task.id, !task.completed); }}
          onClick={(e) => e.stopPropagation()}
          disabled={isAncestorContext}
          style={{ cursor: isAncestorContext ? "default" : "pointer" }}
        />
        {showIds && (
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>#{task.id}</span>
        )}
        <span style={{ textDecoration: task.completed ? "line-through" : "none", color: isAncestorContext ? "#a0aec0" : "inherit" }}>
          {task.title}
        </span>
        {task.children.length > 0 && !isCollapsed && (
          <span
            onClick={(e) => { e.stopPropagation(); navigation.toggleCollapse(task); }}
            style={{ cursor: "pointer", color: "#64748b", fontSize: 12, marginLeft: 4, userSelect: "none" }}
          >
            {"\u2212"}
          </span>
        )}
        {isCollapsed && descendantCount > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); navigation.toggleCollapse(task); }}
            style={{ cursor: "pointer", fontSize: 11, color: "#64748b", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 9, padding: "1px 6px", marginLeft: 4, userSelect: "none" }}
          >
            {completedDescendantCount}/{descendantCount}
          </span>
        )}
        {hiddenCompletedCount > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); navigation.toggleRevealCompleted(task.id); }}
            style={{ cursor: "pointer", fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 9, padding: "1px 6px", marginLeft: 4, userSelect: "none" }}
          >
            +{hiddenCompletedCount} ✓
          </span>
        )}
      </div>

      {visibleChildren.length > 0 && areAllChildrenLeaves(task) && (
        <div style={{ marginTop: 6 }}>
          <ConnectedList
            items={visibleChildren.map(c => ({ key: c.id, task: c }))}
            renderItem={(item) => {
              const child = item.task;
              const isChildAncestorContext = planTaskIds != null && !planTaskIds.has(child.id);
              const isChildSelected = child.id === selectedTaskId;
              const isChildInvalid = isRelocating && relocatingSubtree !== null && isDescendant(relocatingSubtree, child.id);
              const isChildValid = isRelocating && !isChildInvalid;
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: isChildValid ? "#dcfce7" : isChildSelected ? "#dbeafe" : "transparent",
                    cursor: isChildInvalid ? "not-allowed" : isChildValid ? "copy" : "pointer",
                    fontSize: 13,
                    opacity: child.completed ? 0.5 : isChildInvalid ? 0.3 : 1,
                  }}
                  onClick={() => { if (!isChildInvalid) onSelectTask(child.id); }}
                >
                  <input
                    type="checkbox"
                    checked={child.completed}
                    onChange={() => { if (!isChildAncestorContext) onToggleCompleted(child.id, !child.completed); }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isChildAncestorContext}
                    style={{ cursor: isChildAncestorContext ? "default" : "pointer" }}
                  />
                  {showIds && (
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>#{child.id}</span>
                  )}
                  <span style={{ textDecoration: child.completed ? "line-through" : "none" }}>
                    {child.title}
                  </span>
                </div>
              );
            }}
          />
        </div>
      )}

      {visibleChildren.length > 0 && !areAllChildrenLeaves(task) && (() => {
        const branches = visibleChildren.filter(c => c.children.length > 0);
        const atomics = visibleChildren.filter(c => c.children.length === 0);
        const allColumns = branches.length + (atomics.length > 0 ? 1 : 0);
        return (
          <>
            <div style={{ width: 2, height: 20, background: "#555" }} />
            <div style={{ display: "flex", gap: 24, position: "relative" }}>
              {allColumns > 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "calc(50% - 50%)",
                    width: "100%",
                    height: 2,
                    background: "#555",
                  }}
                />
              )}
              {branches.map((child) => (
                <div
                  key={child.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div style={{ width: 2, height: 20, background: "#555" }} />
                  <TaskNode
                    task={child}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={onSelectTask}
                    onToggleCompleted={onToggleCompleted}
                    relocatingTaskId={relocatingTaskId}
                    relocatingSubtree={relocatingSubtree}
                    navigation={navigation}
                    showIds={showIds}
                    planTaskIds={planTaskIds}
                    editingPlanTaskIds={editingPlanTaskIds}
                  />
                </div>
              ))}
              {atomics.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 2, height: 20, background: "#555" }} />
                  <ConnectedList
                    items={atomics.map(c => ({ key: c.id, task: c }))}
                    renderItem={(item) => {
                      const child = item.task;
                      const isChildAncestorCtx = planTaskIds != null && !planTaskIds.has(child.id);
                      const isChildSelected = child.id === selectedTaskId;
                      const isChildInvalid = isRelocating && relocatingSubtree !== null && isDescendant(relocatingSubtree, child.id);
                      const isChildValid = isRelocating && !isChildInvalid;
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            border: `2px solid ${isChildValid ? "#16a34a" : isChildSelected ? "#2563eb" : "#555"}`,
                            borderRadius: 6,
                            background: isChildValid ? "#dcfce7" : isChildSelected ? "#dbeafe" : "#fff",
                            cursor: isChildInvalid ? "not-allowed" : isChildValid ? "copy" : "pointer",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                            opacity: child.completed ? 0.5 : isChildInvalid ? 0.3 : 1,
                          }}
                          onClick={() => { if (!isChildInvalid) onSelectTask(child.id); }}
                        >
                          <input
                            type="checkbox"
                            checked={child.completed}
                            onChange={() => { if (!isChildAncestorCtx) onToggleCompleted(child.id, !child.completed); }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isChildAncestorCtx}
                            style={{ cursor: isChildAncestorCtx ? "default" : "pointer" }}
                          />
                          {showIds && (
                            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>#{child.id}</span>
                          )}
                          <span style={{ textDecoration: child.completed ? "line-through" : "none" }}>
                            {child.title}
                          </span>
                        </div>
                      );
                    }}
                  />
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}

interface TreeViewProps {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
  navigation: NavigationState;
  showIds: boolean;
  planTaskIds?: Set<number> | null;
  editingPlanTaskIds?: Set<number> | null;
  planProgress?: { completed: number; total: number } | null;
}

export default function TreeView({ task, selectedTaskId, onSelectTask, onToggleCompleted, relocatingTaskId, navigation, showIds, planTaskIds, editingPlanTaskIds, planProgress }: TreeViewProps) {
  const relocatingSubtree = relocatingTaskId ? findTask(task, relocatingTaskId) : null;

  const pct = planProgress && planProgress.total > 0 ? planProgress.completed / planProgress.total : 0;

  return (
    <div style={{ padding: 40, overflowX: "auto" }}>
      {planProgress && !editingPlanTaskIds && (
        <div style={{ maxWidth: 300, margin: "0 auto 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
            {planProgress.completed}/{planProgress.total} ({Math.round(pct * 100)}%)
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0" }}>
            <div style={{ height: 6, borderRadius: 3, background: "#10b981", width: `${pct * 100}%`, transition: "width 300ms" }} />
          </div>
        </div>
      )}
      <TaskNode
        task={task}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleCompleted={onToggleCompleted}
        relocatingTaskId={relocatingTaskId}
        relocatingSubtree={relocatingSubtree}
        navigation={navigation}
        showIds={showIds}
        planTaskIds={planTaskIds}
        editingPlanTaskIds={editingPlanTaskIds}
      />
    </div>
  );
}

function findTask(node: Task, id: number): Task | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findTask(child, id);
    if (found) return found;
  }
  return null;
}
