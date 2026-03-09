import { Task } from "./types";

interface TreeViewV2Props {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
}

export default function TreeViewV2({ task }: TreeViewV2Props) {
  return (
    <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
      <p>V2 tree view — coming soon. Root: {task.title}</p>
    </div>
  );
}
