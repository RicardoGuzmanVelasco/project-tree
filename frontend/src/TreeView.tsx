import { Task } from "./types";

function TaskNode({ task }: { task: Task }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          padding: "6px 14px",
          border: "2px solid #555",
          borderRadius: 6,
          background: "#fff",
          fontSize: 14,
          whiteSpace: "nowrap",
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
                <TaskNode task={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TreeView({ task }: { task: Task }) {
  return (
    <div style={{ padding: 40, overflowX: "auto" }}>
      <TaskNode task={task} />
    </div>
  );
}
