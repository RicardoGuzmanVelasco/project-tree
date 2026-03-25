import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchProjects, fetchTree, fetchPlans, updatePlan, createTask, toggleTaskCompletion, relocateTask, deleteTask, renameTask, updateDescription } from "./api";
import { saveField, loadField, saveGlobal, loadGlobal } from "./viewStore";
import { Task, Plan } from "./types";
import { useNavigationState, computeMaxDepth } from "./useNavigationState";
import TreeView from "./TreeView";
import TreeViewV2 from "./TreeViewV2";

type ViewMode = "classic" | "v2";

export default function App() {
  const [projects, setProjects] = useState<{slug: string; title: string}[]>([]);
  const [currentSlug, setCurrentSlug] = useState(() => loadGlobal("currentSlug", "project-tree"));
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => loadGlobal("selectedTaskId", null));
  const [newTitle, setNewTitle] = useState("");
  const [relocatingTaskId, setRelocatingTaskId] = useState<number | null>(null);
  const [renamingTaskId, setRenamingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [deleteClicksRemaining, setDeleteClicksRemaining] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadGlobal("viewMode", "classic") as ViewMode);
  const [showIds, setShowIds] = useState(() => loadGlobal("showIds", false));
  const [showDescription, setShowDescription] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandError, setCommandError] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(() => loadGlobal("activePlanId", null));
  const [editingPlan, setEditingPlan] = useState(false);
  const navigation = useNavigationState(currentSlug);

  // Persist global preferences
  useEffect(() => { saveGlobal("currentSlug", currentSlug); }, [currentSlug]);
  useEffect(() => { saveGlobal("selectedTaskId", selectedTaskId); }, [selectedTaskId]);
  useEffect(() => { saveGlobal("viewMode", viewMode); }, [viewMode]);
  useEffect(() => { saveGlobal("showIds", showIds); }, [showIds]);
  useEffect(() => { saveGlobal("activePlanId", activePlanId); }, [activePlanId]);

  const loadTree = (slug: string) => fetchTree(slug).then(setTree).catch(() => setError("Could not load tree"));

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => setError("Could not load projects"));
    fetchPlans(currentSlug).then(setPlans).catch(() => {});
    loadTree(currentSlug);
  }, []);

  const handleSwitchProject = (slug: string) => {
    setCurrentSlug(slug);
    setTree(null);
    setSelectedTaskId(null);
    setRelocatingTaskId(null);
    setRenamingTaskId(null);
    setDeletingTaskId(null);
    setDeleteClicksRemaining(0);
    setNewTitle("");
    setActivePlanId(null);
    navigation.reset();
    loadTree(slug);
    fetchPlans(slug).then(setPlans).catch(() => {});
  };

  const handleCreate = async () => {
    if (!selectedTaskId || !newTitle.trim()) return;
    const newTask = await createTask(currentSlug, selectedTaskId, newTitle.trim());
    if (activePlan && newTask?.id) {
      const updated = await updatePlan(currentSlug, activePlan.id, [...activePlan.taskIds, newTask.id]);
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
    setNewTitle("");
    loadTree(currentSlug);
  };

  const handleToggleCompleted = async (id: number, completed: boolean) => {
    await toggleTaskCompletion(currentSlug, id, completed);
    loadTree(currentSlug);
  };

  const handleTogglePlanTask = async (id: number) => {
    if (!activePlan) return;
    const inPlan = activePlan.taskIds.includes(id);
    const newTaskIds = inPlan
      ? activePlan.taskIds.filter(t => t !== id)
      : [...activePlan.taskIds, id];
    const updated = await updatePlan(currentSlug, activePlan.id, newTaskIds);
    setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleTaskClick = async (id: number) => {
    if (editingPlan) {
      handleTogglePlanTask(id);
      return;
    }
    if (relocatingTaskId) {
      if (id === relocatingTaskId) return;
      await relocateTask(currentSlug, relocatingTaskId, id);
      setRelocatingTaskId(null);
      setSelectedTaskId(null);
      loadTree(currentSlug);
    } else {
      if (id !== selectedTaskId) setShowDescription(false);
      setSelectedTaskId(id);
    }
  };

  // Filter tree to only show plan tasks + their ancestors
  const activePlan = plans.find(p => p.id === activePlanId) || null;

  const filterTreeForPlan = useCallback((node: Task, planTaskIds: Set<number>): Task | null => {
    // Check if this node or any descendant is in the plan
    const isInPlan = planTaskIds.has(node.id);
    const filteredChildren = node.children
      .map(c => filterTreeForPlan(c, planTaskIds))
      .filter((c): c is Task => c !== null);
    if (!isInPlan && filteredChildren.length === 0) return null;
    return { ...node, children: filteredChildren };
  }, []);

  const planTaskIds = useMemo(() => {
    if (!activePlan) return null;
    const ids = new Set(activePlan.taskIds);
    ids.add(-1); // fake plan root is always "in plan"
    return ids;
  }, [activePlan]);

  const planProgress = useMemo(() => {
    if (!tree || !activePlan) return null;
    const total = activePlan.taskIds.length;
    let completed = 0;
    const check = (node: Task) => {
      if (activePlan.taskIds.includes(node.id) && node.completed) completed++;
      node.children.forEach(check);
    };
    check(tree);
    return { completed, total };
  }, [tree, activePlan]);

  const visibleTree = useMemo(() => {
    if (!tree) return null;
    if (editingPlan) return tree; // show full tree when editing plan
    if (!planTaskIds || !activePlan) return tree;
    const filtered = filterTreeForPlan(tree, planTaskIds);
    if (!filtered) return tree;
    // Replace root with a fake plan node
    return {
      id: -1,
      title: activePlan.name,
      completed: false,
      children: filtered.children,
    };
  }, [tree, planTaskIds, activePlan, planProgress, filterTreeForPlan, editingPlan]);

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

  const handleCommandSubmit = () => {
    if (!tree) return;
    const id = parseInt(commandInput.trim());
    if (isNaN(id)) { setCommandError(true); return; }
    const task = findTaskInTree(tree, id);
    if (!task) { setCommandError(true); return; }
    setSelectedTaskId(id);
    setShowCommandPalette(false);
    setShowDescription(false);
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
        await deleteTask(currentSlug, selectedTaskId);
        setSelectedTaskId(null);
        cancelDelete();
        loadTree(currentSlug);
      } else {
        setDeleteClicksRemaining(deleteClicksRemaining - 1);
      }
    } else {
      // First click
      const descendants = countDescendants(task);
      if (descendants === 0) {
        await deleteTask(currentSlug, selectedTaskId);
        setSelectedTaskId(null);
        cancelDelete();
        loadTree(currentSlug);
      } else {
        setDeletingTaskId(selectedTaskId);
        setDeleteClicksRemaining(descendants);
      }
    }
  };

  const cancelRename = useCallback(() => {
    setRenamingTaskId(null);
    setNewTitle("");
  }, []);

  const startRename = () => {
    if (!selectedTaskId || !tree) return;
    const task = findTaskInTree(tree, selectedTaskId);
    if (!task) return;
    setRenamingTaskId(selectedTaskId);
    setNewTitle(task.title);
  };

  const handleRename = async () => {
    if (!renamingTaskId || !newTitle.trim()) return;
    await renameTask(currentSlug, renamingTaskId, newTitle.trim());
    setRenamingTaskId(null);
    setNewTitle("");
    loadTree(currentSlug);
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

  // Cancel rename when selecting a different task
  useEffect(() => {
    if (renamingTaskId && selectedTaskId !== renamingTaskId) {
      cancelRename();
    }
  }, [selectedTaskId, renamingTaskId, cancelRename]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (showDescription) { setShowDescription(false); return; }
        cancelRelocate();
        cancelDelete();
        cancelRename();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showCommandPalette, showDescription, cancelRelocate, cancelDelete, cancelRename]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "v") {
        setViewMode(m => m === "classic" ? "v2" : "classic");
      }
      if (e.key === "i") {
        setShowIds(s => !s);
      }
      if (e.key === "d" && selectedTaskId) {
        e.preventDefault();
        setShowDescription(d => !d);
      }
      if (e.key === "g") {
        e.preventDefault();
        setShowCommandPalette(prev => {
          if (!prev) { setCommandInput(""); setCommandError(false); }
          return !prev;
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskId]);

  const maxDepth = useMemo(() => tree ? computeMaxDepth(tree) : 0, [tree]);

  // Number key shortcuts for depth levels
  useEffect(() => {
    if (!tree) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= maxDepth) {
        navigation.collapseToDepth(tree, num);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tree, maxDepth, navigation]);

  if (error) return <p>{error}</p>;
  if (!tree) return <p>Loading...</p>;

  const isRoot = selectedTaskId === tree.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "8px 40px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <select
          value={currentSlug}
          onChange={(e) => handleSwitchProject(e.target.value)}
          style={{ padding: "4px 8px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}
        >
          {projects.map(p => (
            <option key={p.slug} value={p.slug}>{p.title}</option>
          ))}
        </select>
        <select
          value={activePlanId ?? ""}
          onChange={(e) => { setActivePlanId(e.target.value ? Number(e.target.value) : null); setEditingPlan(false); }}
          style={{ padding: "4px 8px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 4, background: activePlanId ? "#dbeafe" : "#f8fafc", cursor: "pointer" }}
        >
          <option value="">All tasks</option>
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {activePlanId && (
          <button
            onClick={() => setEditingPlan(e => !e)}
            style={{
              padding: "4px 12px",
              fontSize: 13,
              background: editingPlan ? "#fbbf24" : "#f1f5f9",
              border: `1px solid ${editingPlan ? "#f59e0b" : "#cbd5e1"}`,
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: editingPlan ? 600 : 400,
            }}
          >
            {editingPlan ? "Done editing" : "Edit plan"}
          </button>
        )}
        <button
          onClick={() => setViewMode(m => m === "classic" ? "v2" : "classic")}
          style={{ padding: "4px 12px", fontSize: 13, background: viewMode === "v2" ? "#dbeafe" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
        >
          {viewMode === "classic" ? "Switch to V2" : "Switch to Classic"} (V)
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13, color: "#475569", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={navigation.hideCompleted}
              onChange={(e) => navigation.setHideCompleted(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Hide completed
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13, color: "#475569", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={showIds}
              onChange={(e) => setShowIds(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Show IDs (I)
          </label>
        {maxDepth > 1 && (() => {
          const effectiveDepth = navigation.depthLevel ?? maxDepth;
          return (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#475569" }}>
            <span>Collapse from lvl</span>
            <button
              onClick={() => {
                const next = Math.max(1, effectiveDepth - 1);
                navigation.collapseToDepth(tree, next);
              }}
              disabled={effectiveDepth <= 1}
              style={{ width: 24, height: 24, fontSize: 14, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              {"\u2212"}
            </button>
            <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>
              {effectiveDepth}
            </span>
            <button
              onClick={() => {
                const next = Math.min(maxDepth, effectiveDepth + 1);
                navigation.collapseToDepth(tree, next);
              }}
              disabled={effectiveDepth >= maxDepth}
              style={{ width: 24, height: 24, fontSize: 14, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              +
            </button>
          </div>
          );
        })()}
        </div>
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
            onKeyDown={(e) => e.key === "Enter" && (renamingTaskId ? handleRename() : handleCreate())}
            placeholder={renamingTaskId ? "New task title" : "New child task title"}
            style={{ padding: "6px 10px", fontSize: 14 }}
          />
          {renamingTaskId ? (
            <>
              <button onClick={handleRename} style={{ padding: "6px 14px", fontSize: 14 }}>
                Rename
              </button>
              <button onClick={cancelRename} style={{ padding: "6px 14px", fontSize: 14 }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCreate} style={{ padding: "6px 14px", fontSize: 14 }}>
                Create
              </button>
              <button
                onClick={() => setShowDescription(d => !d)}
                style={{
                  padding: "6px 14px",
                  fontSize: 14,
                  ...(showDescription ? { background: "#2563eb", color: "white", borderColor: "#2563eb" } : {}),
                }}
              >
                Description
              </button>
              {!isRoot && (
                <>
                  <button onClick={startRename} style={{ padding: "6px 14px", fontSize: 14 }}>
                    Rename
                  </button>
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
            </>
          )}
        </div>
      )}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {showDescription && selectedTaskId && (() => {
          const task = findTaskInTree(tree, selectedTaskId);
          if (!task) return null;
          return (
            <div
              onClick={() => setShowDescription(false)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                background: "rgba(0, 0, 0, 0.15)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  padding: "24px 28px",
                  width: "min(520px, 90%)",
                  maxHeight: "70vh",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                  {task.title}
                </div>
                <textarea
                  key={selectedTaskId}
                  defaultValue={task.description || ""}
                  placeholder="Add a description..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                      setShowDescription(false);
                    }
                  }}
                  onBlur={async (e) => {
                    const value = e.target.value;
                    if (value !== (task.description || "")) {
                      await updateDescription(currentSlug, selectedTaskId, value);
                      const updated = await fetchTree(currentSlug);
                      setTree(updated);
                    }
                  }}
                  style={{
                    width: "100%",
                    minHeight: 120,
                    fontSize: 14,
                    color: "#475569",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
              </div>
            </div>
          );
        })()}
      {viewMode === "classic" ? (
        <TreeView
          task={visibleTree!}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleTaskClick}
          onToggleCompleted={handleToggleCompleted}
          relocatingTaskId={relocatingTaskId}
          navigation={navigation}
          showIds={showIds}
          planTaskIds={editingPlan ? null : planTaskIds}
          editingPlanTaskIds={editingPlan ? planTaskIds : null}
          planProgress={planProgress}
        />
      ) : (
        <TreeViewV2
          task={visibleTree!}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleTaskClick}
          onToggleCompleted={handleToggleCompleted}
          relocatingTaskId={relocatingTaskId}
          navigation={navigation}
          showIds={showIds}
          planTaskIds={editingPlan ? null : planTaskIds}
          editingPlanTaskIds={editingPlan ? planTaskIds : null}
          planProgress={planProgress}
        />
      )}
      {showCommandPalette && (
        <div
          onClick={() => setShowCommandPalette(false)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            background: "rgba(0, 0, 0, 0.15)",
            display: "flex",
            justifyContent: "center",
            paddingTop: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              padding: "12px 16px",
              width: "min(400px, 90%)",
              height: "fit-content",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>Go to task</div>
            <input
              autoFocus
              value={commandInput}
              onChange={(e) => { setCommandInput(e.target.value); setCommandError(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommandSubmit();
                if (e.key === "Escape") setShowCommandPalette(false);
              }}
              placeholder="Task ID (e.g. 134)"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 15,
                border: `1.5px solid ${commandError ? "#ef4444" : "#e2e8f0"}`,
                borderRadius: 8,
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 150ms",
              }}
            />
            {commandError && (
              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>Task not found</div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
