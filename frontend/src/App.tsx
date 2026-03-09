import { useEffect, useState, useCallback } from "react";
import { fetchTree, createTask, toggleTaskCompletion, relocateTask } from "./api";
import { Task } from "./types";
import TreeView from "./TreeView";

export default function App() {
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [relocatingTaskId, setRelocatingTaskId] = useState<number | null>(null);

  const loadTree = () => fetchTree().then(setTree).catch(() => setError("Could not load tree"));

  useEffect(() => { loadTree(); }, []);

  const handleCreate = async () => {
    if (!selectedTaskId || !newTitle.trim()) return;
    await createTask(selectedTaskId, newTitle.trim());
    setNewTitle("");
    loadTree();
  };

  const handleToggleCompleted = async (id: number, completed: boolean) => {
    await toggleTaskCompletion(id, completed);
    loadTree();
  };

  const handleTaskClick = async (id: number) => {
    if (relocatingTaskId) {
      if (id === relocatingTaskId) return;
      await relocateTask(relocatingTaskId, id);
      setRelocatingTaskId(null);
      setSelectedTaskId(null);
      loadTree();
    } else {
      setSelectedTaskId(id);
    }
  };

  const cancelRelocate = useCallback(() => {
    setRelocatingTaskId(null);
  }, []);

  useEffect(() => {
    if (!relocatingTaskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRelocate();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [relocatingTaskId, cancelRelocate]);

  if (error) return <p>{error}</p>;
  if (!tree) return <p>Loading...</p>;

  const isRoot = selectedTaskId === tree.id;

  return (
    <div>
      {relocatingTaskId && (
        <div style={{ padding: "12px 40px", display: "flex", gap: 8, alignItems: "center", background: "#fef3c7", borderBottom: "1px solid #f59e0b" }}>
          <span style={{ fontSize: 14 }}>Click a task to set as new parent</span>
          <button onClick={cancelRelocate} style={{ padding: "6px 14px", fontSize: 14 }}>
            Cancel
          </button>
        </div>
      )}
      {selectedTaskId && !relocatingTaskId && (
        <div style={{ padding: "12px 40px", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New child task title"
            style={{ padding: "6px 10px", fontSize: 14 }}
          />
          <button onClick={handleCreate} style={{ padding: "6px 14px", fontSize: 14 }}>
            Create
          </button>
          {!isRoot && (
            <button
              onClick={() => setRelocatingTaskId(selectedTaskId)}
              style={{ padding: "6px 14px", fontSize: 14 }}
            >
              Relocate
            </button>
          )}
        </div>
      )}
      <TreeView
        task={tree}
        selectedTaskId={selectedTaskId}
        onSelectTask={handleTaskClick}
        onToggleCompleted={handleToggleCompleted}
        relocatingTaskId={relocatingTaskId}
      />
    </div>
  );
}
