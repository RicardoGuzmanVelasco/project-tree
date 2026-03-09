import { useEffect, useState } from "react";
import { fetchTree, createTask } from "./api";
import { Task } from "./types";
import TreeView from "./TreeView";

export default function App() {
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const loadTree = () => fetchTree().then(setTree).catch(() => setError("Could not load tree"));

  useEffect(() => { loadTree(); }, []);

  const handleCreate = async () => {
    if (!selectedTaskId || !newTitle.trim()) return;
    await createTask(selectedTaskId, newTitle.trim());
    setNewTitle("");
    loadTree();
  };

  if (error) return <p>{error}</p>;
  if (!tree) return <p>Loading...</p>;

  return (
    <div>
      {selectedTaskId && (
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
        </div>
      )}
      <TreeView
        task={tree}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  );
}
