import { Task } from "./types";

interface TaskNodeProps {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
}

function TaskNode({ task, selectedTaskId, onSelectTask }: TaskNodeProps) {
  const isSelected = task.id === selectedTaskId;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        onClick={() => onSelectTask(task.id)}
        style={{
          padding: "6px 14px",
          border: `2px solid ${isSelected ? "#2563eb" : "#555"}`,
          borderRadius: 6,
          background: isSelected ? "#dbeafe" : "#fff",
          fontSize: 14,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {task.title}
      </div>

      {task.children.length > 0 && (
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
}

export default function TreeView({ task, selectedTaskId, onSelectTask }: TreeViewProps) {
  return (
    <div style={{ padding: 40, overflowX: "auto" }}>
      <TaskNode task={task} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />
    </div>
  );
}
