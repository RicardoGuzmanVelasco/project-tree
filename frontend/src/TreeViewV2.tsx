import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { Task } from "./types";
import { NavigationState } from "./useNavigationState";
import { layoutTree, LayoutNode } from "./treeLayout";

interface TreeViewV2Props {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
  navigation: NavigationState;
  showIds: boolean;
}

const DEPTH_FONT_SIZES = [15, 14, 13];

type RelocateStatus = "none" | "source" | "valid-target" | "invalid-target";

function SvgNode({
  node,
  isSelected,
  onSelect,
  onToggleCompleted,
  relocateStatus,
  isCollapsed,
  onToggleCollapse,
  hiddenCompletedCount,
  onToggleRevealCompleted,
  isFocusDimmed,
  onDoubleClick,
  showIds,
}: {
  node: LayoutNode;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCompleted: () => void;
  relocateStatus: RelocateStatus;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hiddenCompletedCount: number;
  onToggleRevealCompleted: () => void;
  isFocusDimmed: boolean;
  onDoubleClick: () => void;
  showIds: boolean;
}) {
  const { width, height, depth, task } = node;
  // SvgNode draws at local origin (0,0); parent <g> positions it via transform
  const fontSize = DEPTH_FONT_SIZES[Math.min(depth, DEPTH_FONT_SIZES.length - 1)];

  const isInvalid = relocateStatus === "invalid-target";
  const isValid = relocateStatus === "valid-target";
  const isSource = relocateStatus === "source";

  let fill = isSelected ? "#dbeafe" : "#fff";
  let stroke = isSelected ? "#3b82f6" : "#e2e8f0";
  let strokeWidth = isSelected ? 2 : 1;
  let strokeDasharray: string | undefined;
  let nodeOpacity = task.completed ? 0.5 : 1;
  let cursor = "pointer";

  if (isValid) {
    fill = "#dcfce7";
    stroke = "#16a34a";
    strokeWidth = 2;
    cursor = "copy";
  } else if (isInvalid) {
    nodeOpacity = 0.3;
    cursor = "not-allowed";
  } else if (isSource) {
    strokeDasharray = "4 3";
    stroke = "#3b82f6";
    strokeWidth = 2;
  }

  const handleClick = () => {
    if (isInvalid) return;
    onSelect();
  };

  // Atomic child: compact inline rendering (no box, no shadow)
  if (node.isAtomicChild) {
    const atomicFontSize = Math.max(12, fontSize - 1);
    let bgFill = "transparent";
    if (isValid) bgFill = "#dcfce7";
    else if (isSelected) bgFill = "#dbeafe";

    return (
      <g
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        style={{ cursor, opacity: isFocusDimmed ? 0.15 : undefined }}
      >
        <rect x={0} y={0} width={width} height={height} rx={4} fill={bgFill} opacity={nodeOpacity} />
        {/* Completion circle with larger hit area */}
        <circle cx={12} cy={height / 2} r={10} fill="transparent"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }}
          style={{ cursor: "pointer" }}
        />
        <circle
          cx={12}
          cy={height / 2}
          r={5}
          fill={task.completed ? "#10b981" : "none"}
          stroke={task.completed ? "#10b981" : "#94a3b8"}
          strokeWidth={1.5}
          pointerEvents="none"
        />
        {task.completed && (
          <path
            d={`M${9.5} ${height / 2} l1.5 1.5 l3.5 -3.5`}
            stroke="#fff"
            strokeWidth={1.5}
            fill="none"
            pointerEvents="none"
          />
        )}
        {showIds && (
          <text
            x={24}
            y={height / 2}
            dominantBaseline="central"
            fontSize={10}
            fill="#94a3b8"
          >
            #{task.id}
          </text>
        )}
        <text
          x={showIds ? 24 + String(task.id).length * 6.5 + 14 : 24}
          y={height / 2}
          dominantBaseline="central"
          fontSize={atomicFontSize}
          fill="#1e293b"
          textDecoration={task.completed ? "line-through" : "none"}
          opacity={task.completed ? 0.5 : 1}
        >
          {task.title}
        </text>
      </g>
    );
  }

  // Regular node: full box rendering
  return (
    <g
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      style={{ cursor, opacity: isFocusDimmed ? 0.15 : undefined }}
    >
      {/* Shadow */}
      <rect
        x={1}
        y={2}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="rgba(0,0,0,0.06)"
      />
      {/* Node background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        opacity={nodeOpacity}
      />
      {/* Completion circle with larger hit area */}
      <circle cx={16} cy={height / 2} r={12} fill="transparent"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }}
        style={{ cursor: "pointer" }}
      />
      <circle
        cx={16}
        cy={height / 2}
        r={6}
        fill={task.completed ? "#10b981" : "none"}
        stroke={task.completed ? "#10b981" : "#94a3b8"}
        strokeWidth={1.5}
        pointerEvents="none"
      />
      {task.completed && (
        <path
          d={`M${13} ${height / 2} l2 2 l4 -4`}
          stroke="#fff"
          strokeWidth={1.5}
          fill="none"
          pointerEvents="none"
        />
      )}
      {/* ID badge */}
      {showIds && (
        <text
          x={28}
          y={height / 2}
          dominantBaseline="central"
          fontSize={10}
          fill="#94a3b8"
        >
          #{task.id}
        </text>
      )}
      {/* Title */}
      <text
        x={showIds ? 28 + String(task.id).length * 6.5 + 14 : 28}
        y={height / 2}
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#1e293b"
        textDecoration={task.completed ? "line-through" : "none"}
        opacity={task.completed ? 0.5 : 1}
      >
        {task.title}
      </text>
      {/* Collapse: minus sign when expanded, +N badge when collapsed */}
      {task.children.length > 0 && !isCollapsed && (
        <g
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          style={{ cursor: "pointer" }}
        >
          <circle cx={width - 14} cy={height / 2} r={8} fill="transparent" />
          <text
            x={width - 14}
            y={height / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {"\u2212"}
          </text>
        </g>
      )}
      {isCollapsed && node.descendantCount > 0 && (() => {
        const label = `${node.completedDescendantCount}/${node.descendantCount}`;
        const badgeW = label.length * 6 + 10;
        return (
          <g
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={width - badgeW - 8}
              y={height / 2 - 8}
              width={badgeW}
              height={16}
              rx={8}
              fill="#f1f5f9"
              stroke="#cbd5e1"
              strokeWidth={0.5}
            />
            <text
              x={width - badgeW / 2 - 8}
              y={height / 2}
              dominantBaseline="central"
              textAnchor="middle"
              fontSize={9}
              fill="#64748b"
            >
              {label}
            </text>
          </g>
        );
      })()}
      {hiddenCompletedCount > 0 && (
        <g
          onClick={(e) => { e.stopPropagation(); onToggleRevealCompleted(); }}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={width + 4}
            y={height / 2 - 9}
            width={34}
            height={18}
            rx={9}
            fill="#f0fdf4"
            stroke="#86efac"
            strokeWidth={0.5}
          />
          <text
            x={width + 25}
            y={height / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={9}
            fill="#16a34a"
          >
            +{hiddenCompletedCount} ✓
          </text>
        </g>
      )}
    </g>
  );
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

function filterCompletedChildren(
  task: Task,
  revealedParentIds: Set<number>,
  hiddenCounts: Map<number, number>,
): Task {
  const filtered = task.children.filter(c => {
    if (!c.completed) return true;
    if (revealedParentIds.has(task.id)) return true;
    return false;
  });
  const hiddenCount = task.children.length - filtered.length;
  if (hiddenCount > 0) hiddenCounts.set(task.id, hiddenCount);
  return {
    ...task,
    children: filtered.map(c => filterCompletedChildren(c, revealedParentIds, hiddenCounts)),
  };
}

function isDescendant(node: Task, targetId: number): boolean {
  if (node.id === targetId) return true;
  return node.children.some(c => isDescendant(c, targetId));
}

function findTask(node: Task, id: number): Task | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findTask(child, id);
    if (found) return found;
  }
  return null;
}

function findParentTask(root: Task, targetId: number): Task | null {
  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParentTask(child, targetId);
    if (found) return found;
  }
  return null;
}

function getPathToTask(root: Task, targetId: number): Task[] {
  if (root.id === targetId) return [root];
  for (const child of root.children) {
    const path = getPathToTask(child, targetId);
    if (path.length > 0) return [root, ...path];
  }
  return [];
}

function collectDescendantIds(task: Task): Set<number> {
  const ids = new Set<number>();
  const stack = [task];
  while (stack.length > 0) {
    const t = stack.pop()!;
    ids.add(t.id);
    for (const c of t.children) stack.push(c);
  }
  return ids;
}

export default function TreeViewV2({
  task,
  selectedTaskId,
  onSelectTask,
  onToggleCompleted,
  relocatingTaskId,
  navigation,
  showIds,
}: TreeViewV2Props) {
  const { collapsedIds, hideCompleted, revealedParentIds } = navigation;
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);

  const { filteredTree, hiddenCompletedCounts } = useMemo(() => {
    if (!hideCompleted) return { filteredTree: task, hiddenCompletedCounts: new Map<number, number>() };
    const counts = new Map<number, number>();
    const filtered = filterCompletedChildren(task, revealedParentIds, counts);
    return { filteredTree: filtered, hiddenCompletedCounts: counts };
  }, [task, hideCompleted, revealedParentIds]);

  const nodes = useMemo(() => layoutTree(filteredTree, collapsedIds), [filteredTree, collapsedIds]);
  const relocatingSubtree = relocatingTaskId ? findTask(task, relocatingTaskId) : null;

  const focusedSubtree = focusedTaskId ? findTask(task, focusedTaskId) : null;
  const focusedIds = useMemo(() => {
    if (!focusedSubtree) return null;
    return collectDescendantIds(focusedSubtree);
  }, [focusedSubtree]);

  const breadcrumbPath = useMemo(() => {
    if (!focusedTaskId) return [];
    return getPathToTask(task, focusedTaskId);
  }, [task, focusedTaskId]);

  const nodeById = useMemo(() => {
    const map = new Map<number, LayoutNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const connectors = useMemo(() => {
    const paths: { key: string; d: string; isAtomic: boolean }[] = [];

    // Group atomic children by parent to draw a single vertical line per group
    const atomicsByParent = new Map<number, LayoutNode[]>();

    for (const node of nodes) {
      if (node.parentId == null) continue;
      if (node.isAtomicChild) {
        const group = atomicsByParent.get(node.parentId) || [];
        group.push(node);
        atomicsByParent.set(node.parentId, group);
      } else {
        // Curved connector for branch children
        const parent = nodeById.get(node.parentId);
        if (!parent) continue;
        const x1 = parent.x;
        const y1 = parent.y + parent.height;
        const x2 = node.x;
        const y2 = node.y;
        const midY = (y1 + y2) / 2;
        paths.push({
          key: `${parent.id}-${node.id}`,
          d: `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`,
          isAtomic: false,
        });
      }
    }

    // Draw ConnectedList-style connectors for atomic groups
    const TICK_GAP = 12; // gap between vertical rail and child left edge
    for (const [parentId, children] of atomicsByParent) {
      if (children.length === 0) continue;

      // Vertical rail runs to the left of all children
      const leftEdge = Math.min(...children.map(c => c.x - c.width / 2));
      const railX = leftEdge - TICK_GAP;

      // Vertical line: from first child's top to last child's vertical center
      const firstY = children[0].y;
      const lastChild = children[children.length - 1];
      const lastY = lastChild.y + lastChild.height / 2;

      paths.push({
        key: `atomic-rail-${parentId}`,
        d: `M${railX},${firstY} L${railX},${lastY}`,
        isAtomic: true,
      });

      // Horizontal tick for each child
      for (const child of children) {
        const cy = child.y + child.height / 2;
        paths.push({
          key: `${parentId}-${child.id}`,
          d: `M${railX},${cy} L${leftEdge},${cy}`,
          isAtomic: true,
        });
      }

      // Connect parent bottom to rail top
      const parent = nodeById.get(parentId);
      if (parent) {
        paths.push({
          key: `atomic-stem-${parentId}`,
          d: `M${parent.x},${parent.y + parent.height} L${railX},${firstY}`,
          isAtomic: true,
        });
      }
    }

    return paths;
  }, [nodes, nodeById]);

  // Pan & zoom state in ref to avoid re-renders during drag
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const [animateTransform, setAnimateTransform] = useState(false);

  // Fit to view on initial render and tree changes
  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    const padding = 40;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const left = n.x - n.width / 2;
      const right = n.x + n.width / 2;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    const treeW = maxX - minX + padding * 2;
    const treeH = maxY - minY + padding * 2;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scale = Math.min(cw / treeW, ch / treeH, 1);
    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    setAnimateTransform(true);
    setTransform({
      x: cw / 2 - treeCenterX * scale,
      y: ch / 2 - treeCenterY * scale,
      scale,
    });
    setTimeout(() => setAnimateTransform(false), 300);
  }, [nodes]);

  useEffect(() => { fitToView(); }, [fitToView]);

  // Mouse handlers for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    didDrag.current = false;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!didDrag.current) {
      // Only start actual dragging after exceeding threshold
      if (Math.abs(dx - transformRef.current.x) > 3 || Math.abs(dy - transformRef.current.y) > 3) {
        didDrag.current = true;
      } else {
        return; // Don't move anything until threshold is exceeded
      }
    }
    setTransform(t => ({ ...t, x: dx, y: dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Wheel handler for zoom toward cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;

      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad) or Ctrl+wheel (mouse): zoom toward cursor
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const factor = e.deltaY < 0 ? 1.03 : 0.97;
        const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.scale * factor));
        const ratio = newScale / t.scale;

        setTransform({
          x: cursorX - (cursorX - t.x) * ratio,
          y: cursorY - (cursorY - t.y) * ratio,
          scale: newScale,
        });
      } else {
        // Two-finger scroll (trackpad) or plain wheel (mouse): pan
        setTransform({
          x: t.x - e.deltaX,
          y: t.y - e.deltaY,
          scale: t.scale,
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        fitToView();
        return;
      }

      if (e.key === "m" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowMinimap(prev => !prev);
        return;
      }

      if (e.key === "Escape") {
        if (focusedTaskId !== null) {
          setFocusedTaskId(null);
        } else if (selectedTaskId !== null) {
          onSelectTask(selectedTaskId); // deselect handled by parent
        }
        return;
      }

      // Zoom with +/-
      if (e.key === "=" || e.key === "+") {
        setTransform(t => {
          const newScale = Math.min(MAX_ZOOM, t.scale * 1.2);
          return { ...t, scale: newScale };
        });
        return;
      }
      if (e.key === "-") {
        setTransform(t => {
          const newScale = Math.max(MIN_ZOOM, t.scale * 0.8);
          return { ...t, scale: newScale };
        });
        return;
      }

      // Space = toggle completion
      if (e.key === " " && selectedTaskId !== null) {
        e.preventDefault();
        const selectedNode = findTask(task, selectedTaskId);
        if (selectedNode) onToggleCompleted(selectedTaskId, !selectedNode.completed);
        return;
      }

      // Arrow navigation
      if (!selectedTaskId) return;

      if (e.key === "ArrowLeft") {
        // Go to parent
        const parent = findParentTask(task, selectedTaskId);
        if (parent) onSelectTask(parent.id);
        return;
      }

      if (e.key === "ArrowRight") {
        // Go to first child
        const current = findTask(task, selectedTaskId);
        if (current && current.children.length > 0) onSelectTask(current.children[0].id);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Navigate siblings
        const parent = findParentTask(task, selectedTaskId);
        if (!parent) return;
        const siblings = parent.children;
        const idx = siblings.findIndex(c => c.id === selectedTaskId);
        if (idx === -1) return;
        const nextIdx = e.key === "ArrowUp" ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < siblings.length) {
          onSelectTask(siblings[nextIdx].id);
        }
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fitToView, focusedTaskId, selectedTaskId, task, onSelectTask, onToggleCompleted]);

  // Compute tree bounding box for minimap
  const treeBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const left = n.x - n.width / 2;
      const right = n.x + n.width / 2;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    return { minX, minY, maxX, maxY };
  }, [nodes]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const minimapW = 160;
    const minimapH = 100;
    const padding = 10;

    const treeW = treeBounds.maxX - treeBounds.minX;
    const treeH = treeBounds.maxY - treeBounds.minY;
    if (treeW === 0 || treeH === 0) return;

    const mmScale = Math.min((minimapW - padding * 2) / treeW, (minimapH - padding * 2) / treeH);

    // Convert minimap click to tree coordinates
    const treeX = (clickX - padding) / mmScale + treeBounds.minX;
    const treeY = (clickY - padding) / mmScale + treeBounds.minY;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const t = transformRef.current;

    setAnimateTransform(true);
    setTransform({
      x: cw / 2 - treeX * t.scale,
      y: ch / 2 - treeY * t.scale,
      scale: t.scale,
    });
    setTimeout(() => setAnimateTransform(false), 300);
  }, [treeBounds]);

  // Suppress click on nodes after drag
  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) {
      e.stopPropagation();
      didDrag.current = false;
    }
  }, []);

  return (
    <>
    {breadcrumbPath.length > 0 && (
      <div style={{ padding: "6px 40px", display: "flex", gap: 4, alignItems: "center", fontSize: 13, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
        {breadcrumbPath.map((t, i) => (
          <span key={t.id}>
            {i > 0 && <span style={{ margin: "0 4px" }}>&gt;</span>}
            <span
              style={{ cursor: "pointer", color: i === breadcrumbPath.length - 1 ? "#1e293b" : "#64748b", fontWeight: i === breadcrumbPath.length - 1 ? 600 : 400 }}
              onClick={() => setFocusedTaskId(t.id === task.id ? null : t.id)}
            >
              {t.title}
            </span>
          </span>
        ))}
        <span
          style={{ marginLeft: 8, cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
          onClick={() => setFocusedTaskId(null)}
        >
          (clear)
        </span>
      </div>
    )}
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "calc(100vh - 120px)",
        overflow: "hidden",
        cursor: isDragging.current ? "grabbing" : "grab",
        position: "relative",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: "block", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        onClickCapture={handleSvgClick}
      >
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          style={{ transition: animateTransform ? "transform 300ms ease-out" : "none" }}
        >
          {connectors.map((c) => {
            const [parentIdStr, childIdStr] = c.key.split("-");
            const dimmed = focusedIds !== null && (!focusedIds.has(Number(parentIdStr)) || !focusedIds.has(Number(childIdStr)));
            return (
              <path
                key={c.key}
                d={c.d}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                opacity={dimmed ? 0.15 : 1}
              />
            );
          })}
          {nodes.map((node) => {
            let relocateStatus: RelocateStatus = "none";
            if (relocatingTaskId) {
              if (node.id === relocatingTaskId) {
                relocateStatus = "source";
              } else if (relocatingSubtree && isDescendant(relocatingSubtree, node.id)) {
                relocateStatus = "invalid-target";
              } else {
                relocateStatus = "valid-target";
              }
            }
            const nx = node.x - node.width / 2;
            const ny = node.y;
            return (
              <g
                key={node.id}
                transform={`translate(${nx}, ${ny})`}
                style={{ transition: "transform 300ms ease-out" }}
              >
                <SvgNode
                  node={node}
                  isSelected={node.id === selectedTaskId}
                  onSelect={() => onSelectTask(node.id)}
                  onToggleCompleted={() => onToggleCompleted(node.id, !node.task.completed)}
                  relocateStatus={relocateStatus}
                  isCollapsed={collapsedIds.has(node.id)}
                  onToggleCollapse={() => navigation.toggleCollapse(node.task)}
                  hiddenCompletedCount={hiddenCompletedCounts.get(node.id) ?? 0}
                  onToggleRevealCompleted={() => navigation.toggleRevealCompleted(node.id)}
                  isFocusDimmed={focusedIds !== null && !focusedIds.has(node.id)}
                  onDoubleClick={() => setFocusedTaskId(node.id)}
                  showIds={showIds}
                />
              </g>
            );
          })}
        </g>
      </svg>
      {/* Minimap toggle */}
      {!showMinimap && (
        <button
          onClick={() => setShowMinimap(true)}
          title="Show minimap (M)"
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            width: 28,
            height: 28,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#64748b",
          }}
        >
          M
        </button>
      )}
      {/* Minimap */}
      {showMinimap && (() => {
        const minimapW = 160;
        const minimapH = 100;
        const padding = 10;
        const treeW = treeBounds.maxX - treeBounds.minX;
        const treeH = treeBounds.maxY - treeBounds.minY;
        if (treeW === 0 || treeH === 0) return null;

        const mmScale = Math.min((minimapW - padding * 2) / treeW, (minimapH - padding * 2) / treeH);

        // Viewport indicator
        const container = containerRef.current;
        let vpRect = null;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          // Visible area in tree coords
          const vpLeft = -transform.x / transform.scale;
          const vpTop = -transform.y / transform.scale;
          const vpWidth = cw / transform.scale;
          const vpHeight = ch / transform.scale;
          vpRect = {
            x: (vpLeft - treeBounds.minX) * mmScale + padding,
            y: (vpTop - treeBounds.minY) * mmScale + padding,
            w: vpWidth * mmScale,
            h: vpHeight * mmScale,
          };
        }

        return (
          <div
            onClick={handleMinimapClick}
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              width: minimapW,
              height: minimapH,
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setShowMinimap(false); }}
              title="Hide minimap (M)"
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 18,
                height: 18,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "#94a3b8",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <svg width={minimapW} height={minimapH}>
              {nodes.map((n) => (
                <rect
                  key={n.id}
                  x={(n.x - n.width / 2 - treeBounds.minX) * mmScale + padding}
                  y={(n.y - treeBounds.minY) * mmScale + padding}
                  width={Math.max(2, n.width * mmScale)}
                  height={Math.max(1, n.height * mmScale)}
                  fill={n.id === selectedTaskId ? "#3b82f6" : "#94a3b8"}
                  rx={1}
                />
              ))}
              {vpRect && (
                <rect
                  x={vpRect.x}
                  y={vpRect.y}
                  width={vpRect.w}
                  height={vpRect.h}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  rx={2}
                />
              )}
            </svg>
          </div>
        );
      })()}
    </div>
    </>
  );
}
