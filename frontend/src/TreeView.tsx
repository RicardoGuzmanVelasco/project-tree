import { Task } from "./types";

function areAllChildrenLeaves(task: Task): boolean {
  return task.children.length > 0 && task.children.every(c => c.children.length === 0);
}

function isDescendant(task: Task, targetId: number): boolean {
  if (task.id === targetId) return true;
  return task.children.some(c => isDescendant(c, targetId));
}

interface TaskNodeProps {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
  relocatingSubtree: Task | null;
}

function TaskNode({ task, selectedTaskId, onSelectTask, onToggleCompleted, relocatingTaskId, relocatingSubtree }: TaskNodeProps) {
  const isSelected = task.id === selectedTaskId;
  const isRelocating = relocatingTaskId !== null;
  const isInvalidTarget = isRelocating && relocatingSubtree !== null && isDescendant(relocatingSubtree, task.id);
  const isValidTarget = isRelocating && !isInvalidTarget;

  const nodeOpacity = task.completed ? 0.5 : isInvalidTarget ? 0.3 : 1;
  const nodeCursor = isInvalidTarget ? "not-allowed" : isValidTarget ? "copy" : "pointer";

  const handleClick = () => {
    if (isInvalidTarget) return;
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
          border: `2px solid ${isValidTarget ? "#16a34a" : isSelected ? "#2563eb" : "#555"}`,
          borderRadius: 6,
          background: isValidTarget ? "#dcfce7" : isSelected ? "#dbeafe" : "#fff",
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
          onChange={() => onToggleCompleted(task.id, !task.completed)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "pointer" }}
        />
        <span style={{ textDecoration: task.completed ? "line-through" : "none" }}>
          {task.title}
        </span>
      </div>

      {task.children.length > 0 && areAllChildrenLeaves(task) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8, paddingLeft: 12 }}>
          {task.children.map((child) => {
            const isChildSelected = child.id === selectedTaskId;
            const isChildInvalid = isRelocating && relocatingSubtree !== null && isDescendant(relocatingSubtree, child.id);
            const isChildValid = isRelocating && !isChildInvalid;
            return (
              <div
                key={child.id}
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
                  onChange={() => onToggleCompleted(child.id, !child.completed)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ textDecoration: child.completed ? "line-through" : "none" }}>
                  {child.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {task.children.length > 0 && !areAllChildrenLeaves(task) && (
        <>
          <div style={{ width: 2, height: 20, background: "#555" }} />
          <div style={{ display: "flex", gap: 24, position: "relative" }}>
            {task.children.length > 1 && (
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
            {task.children.map((child) => (
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
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface TreeViewProps {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
}

export default function TreeView({ task, selectedTaskId, onSelectTask, onToggleCompleted, relocatingTaskId }: TreeViewProps) {
  const relocatingSubtree = relocatingTaskId ? findTask(task, relocatingTaskId) : null;

  return (
    <div style={{ padding: 40, overflowX: "auto" }}>
      <TaskNode
        task={task}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleCompleted={onToggleCompleted}
        relocatingTaskId={relocatingTaskId}
        relocatingSubtree={relocatingSubtree}
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
