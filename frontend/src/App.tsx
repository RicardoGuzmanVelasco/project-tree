import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchTree, fetchPlans, createPlan, updatePlan, createTask, toggleTaskCompletion, toggleTaskAbandoned, relocateTask, deleteTask, renameTask, updateDescription, pruneTask } from "./api";
import { saveGlobal, loadGlobal } from "./viewStore";
import { Task, Plan } from "./types";
import { useNavigationState, computeMaxDepth } from "./useNavigationState";
import TreeViewV2 from "./TreeViewV2";
import { computePlanProgress } from "./planProgress";

export default function App() {
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => loadGlobal("selectedTaskId", null));
  const [newTitle, setNewTitle] = useState("");
  const [relocatingTaskId, setRelocatingTaskId] = useState<number | null>(null);
  const [renamingTaskId, setRenamingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [deleteClicksRemaining, setDeleteClicksRemaining] = useState(0);
  const [showIds, setShowIds] = useState(() => loadGlobal("showIds", false));
  const [showDescription, setShowDescription] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandError, setCommandError] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(() => loadGlobal("activePlanId", null));
  const [editingPlan, setEditingPlan] = useState(false);
  const [compact, setCompact] = useState(() => loadGlobal("compact", false));
  const [horizontal, setHorizontal] = useState(() => loadGlobal("horizontal", false));
  const [mindmap, setMindmap] = useState(() => loadGlobal("mindmap", false));
  const navigation = useNavigationState();

  // Persist preferences
  useEffect(() => { saveGlobal("selectedTaskId", selectedTaskId); }, [selectedTaskId]);
  useEffect(() => { saveGlobal("showIds", showIds); }, [showIds]);
  useEffect(() => { saveGlobal("compact", compact); }, [compact]);
  useEffect(() => { saveGlobal("horizontal", horizontal); }, [horizontal]);
  useEffect(() => { saveGlobal("mindmap", mindmap); }, [mindmap]);
  useEffect(() => { saveGlobal("activePlanId", activePlanId); }, [activePlanId]);

  const loadTree = () => fetchTree().then(setTree).catch(() => setError("Could not load tree"));


  useEffect(() => {
    fetchPlans().then(setPlans).catch(() => {});
    loadTree();
  }, []);

  // Live sync: listen for external file changes via SSE
  useEffect(() => {
    const es = new EventSource("/events");
    es.onmessage = (e) => {
      if (e.data === "changed") {
        loadTree();
        fetchPlans().then(setPlans).catch(() => {});
      }
    };
    return () => es.close();
  }, []);

  const handleCreate = async () => {
    if (!selectedTaskId || !newTitle.trim()) return;
    const newTask = await createTask(selectedTaskId, newTitle.trim());
    if (activePlan && newTask?.id) {
      const updated = await updatePlan(activePlan.id, [...activePlan.taskIds, newTask.id]);
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
    setNewTitle("");
    loadTree();
  };

  const handleToggleCompleted = async (id: number, completed: boolean) => {
    await toggleTaskCompletion(id, completed);
    loadTree();
  };

  const handleToggleAbandoned = async (id: number, abandoned: boolean) => {
    await toggleTaskAbandoned(id, abandoned);
    loadTree();
  };

  const handleNewPlan = async () => {
    const name = prompt("Plan name:");
    if (!name?.trim()) return;
    const plan = await createPlan(name.trim());
    setPlans(prev => [...prev, plan]);
    setActivePlanId(plan.id);
    setEditingPlan(true);
  };

  const handleTogglePlanTask = async (id: number) => {
    if (!activePlan) return;
    const inPlan = activePlan.taskIds.includes(id);
    const newTaskIds = inPlan
      ? activePlan.taskIds.filter(t => t !== id)
      : [...activePlan.taskIds, id];
    const updated = await updatePlan(activePlan.id, newTaskIds);
    setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleTaskClick = async (id: number) => {
    if (editingPlan) {
      handleTogglePlanTask(id);
      return;
    }
    if (relocatingTaskId) {
      if (id === relocatingTaskId) return;
      await relocateTask(relocatingTaskId, id);
      setRelocatingTaskId(null);
      setSelectedTaskId(null);
      loadTree();
    } else {
      if (id !== selectedTaskId) setShowDescription(false);
      setSelectedTaskId(id);
    }
  };

  // Filter tree to only show plan tasks + their ancestors
  const activePlan = plans.find(p => p.id === activePlanId) || null;

  // Update browser tab title with project name and active plan
  useEffect(() => {
    if (tree) document.title = activePlan ? `${tree.title} - ${activePlan.name}` : tree.title;
  }, [tree, activePlan]);

  const filterTreeForPlan = useCallback((node: Task, planTaskIds: Set<number>): Task | null => {
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
    ids.add(-1);
    return ids;
  }, [activePlan]);

  const planProgress = useMemo(() => {
    if (!tree || !activePlan) return null;
    return computePlanProgress(tree, activePlan);
  }, [tree, activePlan]);

  // Auto-archive/unarchive plans based on progress
  useEffect(() => {
    if (!activePlan || !planProgress) return;
    const isComplete = planProgress.total > 0 && planProgress.completed === planProgress.total;
    if (isComplete && !activePlan.archived) {
      updatePlan(activePlan.id, activePlan.taskIds, true).then(updated => {
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      });
    } else if (!isComplete && activePlan.archived) {
      updatePlan(activePlan.id, activePlan.taskIds, false).then(updated => {
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      });
    }
  }, [planProgress, activePlan]);

  const visibleTree = useMemo(() => {
    if (!tree) return null;
    if (editingPlan) return tree;
    if (!planTaskIds || !activePlan) return tree;
    const filtered = filterTreeForPlan(tree, planTaskIds);
    if (!filtered) return tree;
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

  const isPrunable = (task: Task): boolean => {
    if (!task.completed && !task.abandoned) return false;
    return task.children.every(isPrunable);
  };

  const hasPrunableChildren = (task: Task): boolean => {
    return task.children.some(isPrunable);
  };

  const countPrunable = (task: Task): number => {
    return task.children
      .filter(isPrunable)
      .reduce((sum, c) => sum + countDescendants(c) + 1, 0);
  };

  const handlePrune = async () => {
    if (!selectedTaskId || !tree) return;
    const task = findTaskInTree(tree, selectedTaskId);
    if (!task || !hasPrunableChildren(task)) return;
    const count = countPrunable(task);
    if (!window.confirm(`Prune ${count} completed task${count !== 1 ? "s" : ""} from "${task.title}"?`)) return;
    await pruneTask(selectedTaskId);
    loadTree();
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
      if (deleteClicksRemaining <= 1) {
        await deleteTask(selectedTaskId);
        setSelectedTaskId(null);
        cancelDelete();
        loadTree();
      } else {
        setDeleteClicksRemaining(deleteClicksRemaining - 1);
      }
    } else {
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
    await renameTask(renamingTaskId, newTitle.trim());
    setRenamingTaskId(null);
    setNewTitle("");
    loadTree();
  };

  const cancelRelocate = useCallback(() => {
    setRelocatingTaskId(null);
  }, []);

  useEffect(() => {
    if (deletingTaskId && selectedTaskId !== deletingTaskId) cancelDelete();
  }, [selectedTaskId, deletingTaskId, cancelDelete]);

  useEffect(() => {
    if (renamingTaskId && selectedTaskId !== renamingTaskId) cancelRename();
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
      if (e.key === "i") setShowIds(s => !s);
      if (e.key === "d" && selectedTaskId) { e.preventDefault(); setShowDescription(d => !d); }
      if (e.key === "g") {
        e.preventDefault();
        setShowCommandPalette(prev => {
          if (!prev) { setCommandInput(""); setCommandError(false); }
          return !prev;
        });
      }
      if (e.key === "c") setCompact(c => !c);
      if (e.key === "h") setHorizontal(h => !h);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskId]);

  const maxDepth = useMemo(() => tree ? computeMaxDepth(tree) : 0, [tree]);

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
      <div className="toolbar">
        <div className="toolbar-group" style={{ padding: "2px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-bg-subtle)" }}>
          <span style={{ fontSize: 11, color: "var(--c-text-faint)", fontWeight: 500, letterSpacing: "0.02em" }}>Plan</span>
          <select
            value={activePlanId ?? ""}
            onChange={(e) => { setActivePlanId(e.target.value ? Number(e.target.value) : null); setEditingPlan(false); }}
            className="input"
            style={{ padding: "3px 8px", fontSize: 12, background: activePlanId ? "var(--c-primary-bg)" : "var(--c-bg)" }}
          >
            <option value="">All tasks</option>
            {plans.filter(p => !p.archived).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {plans.some(p => p.archived) && (
              <optgroup label="Archived">
                {plans.filter(p => p.archived).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button onClick={handleNewPlan} className="btn btn-sm btn-icon" style={{ width: 24, height: 24 }}>+</button>
          {activePlanId && (
            <button
              onClick={() => setEditingPlan(e => !e)}
              className={`btn btn-sm ${editingPlan ? "btn-warning" : ""}`}
            >
              {editingPlan ? "Done" : "Edit"}
            </button>
          )}
        </div>

        <div className="toolbar-separator" />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button className={`pill ${navigation.hideCompleted ? "pill-on" : ""}`} onClick={() => navigation.setHideCompleted(!navigation.hideCompleted)}>
            Hide completed
          </button>
          <button className={`pill ${showIds ? "pill-on" : ""}`} onClick={() => setShowIds(s => !s)}>
            IDs <span className="pill-key">I</span>
          </button>
          <button className={`pill ${compact ? "pill-on" : ""}`} onClick={() => setCompact(c => !c)}>
            Compact <span className="pill-key">C</span>
          </button>
          <button className={`pill ${horizontal ? "pill-on" : ""}`} onClick={() => setHorizontal(h => !h)}>
            Horizontal <span className="pill-key">H</span>
          </button>
          <button className={`pill ${mindmap ? "pill-on" : ""}`} onClick={() => setMindmap(m => !m)}>
            Mindmap
          </button>

          {maxDepth > 1 && (() => {
            const effectiveDepth = navigation.depthLevel ?? maxDepth;
            return (
              <div className="toolbar-group" style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                <span>Depth</span>
                <button
                  onClick={() => navigation.collapseToDepth(tree, Math.max(1, effectiveDepth - 1))}
                  disabled={effectiveDepth <= 1}
                  className="btn btn-icon btn-sm"
                >
                  {"\u2212"}
                </button>
                <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600 }}>{effectiveDepth}</span>
                <button
                  onClick={() => navigation.collapseToDepth(tree, Math.min(maxDepth, effectiveDepth + 1))}
                  disabled={effectiveDepth >= maxDepth}
                  className="btn btn-icon btn-sm"
                >
                  +
                </button>
              </div>
            );
          })()}
        </div>
      </div>
      {relocatingTaskId && (
        <div className="relocate-banner">
          <span>Click a task to set as new parent</span>
          <button onClick={cancelRelocate} className="btn btn-sm">Cancel</button>
        </div>
      )}
      {selectedTaskId && !relocatingTaskId && (
        <div className="action-bar">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (renamingTaskId ? handleRename() : handleCreate())}
            placeholder={renamingTaskId ? "New task title" : "New child task title"}
            className="input"
            style={{ minWidth: 200 }}
          />
          {renamingTaskId ? (
            <div className="action-group">
              <button onClick={handleRename} className="btn btn-primary">Rename</button>
              <button onClick={cancelRename} className="btn">Cancel</button>
            </div>
          ) : (
            <>
              <div className="action-group">
                <button onClick={handleCreate} className="btn btn-primary">Create</button>
                <button
                  onClick={() => setShowDescription(d => !d)}
                  className={`btn ${showDescription ? "btn-toggle-on" : ""}`}
                >
                  Description
                </button>
              </div>
              {!isRoot && (
                <>
                  <div className="action-divider" style={{ width: 1, height: 20, background: "var(--c-border)" }} />
                  <div className="action-group">
                    <button onClick={startRename} className="btn">Rename</button>
                    <button onClick={() => setRelocatingTaskId(selectedTaskId)} className="btn">Relocate</button>
                  </div>
                  <div className="action-divider" style={{ width: 1, height: 20, background: "var(--c-border)" }} />
                  <div className="action-group">
                    <button
                      onClick={() => {
                        const task = findTaskInTree(tree, selectedTaskId!);
                        if (task) handleToggleAbandoned(selectedTaskId!, !task.abandoned);
                      }}
                      className={`btn ${findTaskInTree(tree, selectedTaskId!)?.abandoned ? "btn-purple" : ""}`}
                    >
                      {findTaskInTree(tree, selectedTaskId!)?.abandoned ? "Restore" : "Abandon"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className={`btn ${deletingTaskId === selectedTaskId ? "btn-danger" : ""}`}
                    >
                      {deletingTaskId === selectedTaskId
                        ? `Click ${deleteClicksRemaining} more${deleteClicksRemaining !== 1 ? "" : ""} to confirm`
                        : "Delete"}
                    </button>
                    {(() => {
                      const task = findTaskInTree(tree, selectedTaskId!);
                      return task && hasPrunableChildren(task) ? (
                        <button onClick={handlePrune} className="btn">Prune</button>
                      ) : null;
                    })()}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(/logo.png)", backgroundSize: "120px", backgroundRepeat: "repeat", opacity: 0.06, pointerEvents: "none", zIndex: 0 }} />
        {showDescription && selectedTaskId && (() => {
          const task = findTaskInTree(tree, selectedTaskId);
          if (!task) return null;
          return (
            <div
              onClick={() => setShowDescription(false)}
              className="overlay-backdrop"
              style={{ alignItems: "flex-start", paddingTop: 60, zIndex: 10 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="overlay-card"
                style={{ padding: "24px 28px", width: "min(520px, 90%)", maxHeight: "70vh", display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)" }}>{task.title}</div>
                  <button onClick={() => setShowDescription(false)} className="btn btn-icon btn-sm" style={{ flexShrink: 0 }}>&times;</button>
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
                      await updateDescription(selectedTaskId, value);
                      const updated = await fetchTree();
                      setTree(updated);
                    }
                  }}
                  className="input"
                  style={{ width: "100%", minHeight: 120, fontSize: 14, padding: "10px 12px", resize: "vertical", lineHeight: 1.5, borderRadius: "var(--r-lg)" }}
                />
              </div>
            </div>
          );
        })()}
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
          compact={compact}
          horizontal={horizontal}
          mindmap={mindmap}
        />
        {showCommandPalette && (
          <div
            onClick={() => setShowCommandPalette(false)}
            className="overlay-backdrop"
            style={{ paddingTop: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="overlay-card"
              style={{ padding: "16px 20px", width: "min(400px, 90%)", height: "fit-content" }}
            >
              <div style={{ fontSize: 11, color: "var(--c-text-faint)", marginBottom: 8, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Go to task</div>
              <input
                autoFocus
                value={commandInput}
                onChange={(e) => { setCommandInput(e.target.value); setCommandError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommandSubmit();
                  if (e.key === "Escape") setShowCommandPalette(false);
                }}
                placeholder="Task ID (e.g. 134)"
                className={`input ${commandError ? "input-error" : ""}`}
                style={{ width: "100%", padding: "10px 14px", fontSize: 15, borderRadius: "var(--r-lg)" }}
              />
              {commandError && (
                <div style={{ fontSize: 12, color: "var(--c-danger)", marginTop: 6 }}>Task not found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
