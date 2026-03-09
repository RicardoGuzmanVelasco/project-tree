import { useEffect, useState, useCallback } from "react";
import { fetchTree, createTask, toggleTaskCompletion, relocateTask, deleteTask } from "./api";
import { Task } from "./types";
import TreeView from "./TreeView";
import TreeViewV2 from "./TreeViewV2";

type ViewMode = "classic" | "v2";

export default function App() {
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [relocatingTaskId, setRelocatingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [deleteClicksRemaining, setDeleteClicksRemaining] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("classic");

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

  const countDescendants = (task: Task): number => {
    let count = task.children.length;
    for (const child of task.children) {
      count += countDescendants(child);
    }
    return count;
  };

  const findTaskInTree = (node: Task, id: number): Task | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findTaskInTree(child, id);
      if (found) return found;
    }
    return null;
  };

  const cancelDelete = useCallback(() => {
    setDeletingTaskId(null);
    setDeleteClicksRemaining(0);
  }, []);

  const handleDelete = async () => {
    if (!selectedTaskId || !tree) return;
    const task = findTaskInTree(tree, selectedTaskId);
    if (!task) return;

    if (deletingTaskId === selectedTaskId) {
      // Already in confirmation mode
      if (deleteClicksRemaining <= 1) {
        await deleteTask(selectedTaskId);
        setSelectedTaskId(null);
        cancelDelete();
        loadTree();
      } else {
        setDeleteClicksRemaining(deleteClicksRemaining - 1);
      }
    } else {
      // First click
      const descendants = countDescendants(task);
      if (descendants === 0) {
        await deleteTask(selectedTaskId);
        setSelectedTaskId(null);
        cancelDelete();
        loadTree();
      } else {
        setDeletingTaskId(selectedTaskId);
        setDeleteClicksRemaining(descendants);
      }
    }
  };

  const cancelRelocate = useCallback(() => {
    setRelocatingTaskId(null);
  }, []);

  // Cancel delete when selecting a different task
  useEffect(() => {
    if (deletingTaskId && selectedTaskId !== deletingTaskId) {
      cancelDelete();
    }
  }, [selectedTaskId, deletingTaskId, cancelDelete]);

  useEffect(() => {
    if (!relocatingTaskId && !deletingTaskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelRelocate();
        cancelDelete();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [relocatingTaskId, deletingTaskId, cancelRelocate, cancelDelete]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "v" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setViewMode(m => m === "classic" ? "v2" : "classic");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (error) return <p>{error}</p>;
  if (!tree) return <p>Loading...</p>;

  const isRoot = selectedTaskId === tree.id;

  return (
    <div>
      <div style={{ padding: "8px 40px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <button
          onClick={() => setViewMode(m => m === "classic" ? "v2" : "classic")}
          style={{ padding: "4px 12px", fontSize: 13, background: viewMode === "v2" ? "#dbeafe" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
        >
          {viewMode === "classic" ? "Switch to V2" : "Switch to Classic"} (V)
        </button>
      </div>
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
            <>
              <button
                onClick={() => setRelocatingTaskId(selectedTaskId)}
                style={{ padding: "6px 14px", fontSize: 14 }}
              >
                Relocate
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: "6px 14px",
                  fontSize: 14,
                  ...(deletingTaskId === selectedTaskId
                    ? { background: "#dc2626", color: "white", borderColor: "#dc2626" }
                    : {}),
                }}
              >
                {deletingTaskId === selectedTaskId
                  ? `Click ${deleteClicksRemaining} more time${deleteClicksRemaining !== 1 ? "s" : ""} to confirm (deletes ${countDescendants(findTaskInTree(tree, selectedTaskId!)!) + 1} task${countDescendants(findTaskInTree(tree, selectedTaskId!)!) + 1 !== 1 ? "s" : ""})`
                  : "Delete"}
              </button>
            </>
          )}
        </div>
      )}
      {viewMode === "classic" ? (
        <TreeView
          task={tree}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleTaskClick}
          onToggleCompleted={handleToggleCompleted}
          relocatingTaskId={relocatingTaskId}
        />
      ) : (
        <TreeViewV2
          task={tree}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleTaskClick}
          onToggleCompleted={handleToggleCompleted}
          relocatingTaskId={relocatingTaskId}
        />
      )}
    </div>
  );
}
