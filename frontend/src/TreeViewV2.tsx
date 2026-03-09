import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { Task } from "./types";
import { layoutTree, LayoutNode } from "./treeLayout";

interface TreeViewV2Props {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
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
  isFocusDimmed,
  onDoubleClick,
}: {
  node: LayoutNode;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCompleted: () => void;
  relocateStatus: RelocateStatus;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isFocusDimmed: boolean;
  onDoubleClick: () => void;
}) {
  const { x, y, width, height, depth, task } = node;
  const rx = x - width / 2;
  const ry = y;
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

  return (
    <g
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      style={{ cursor, opacity: isFocusDimmed ? 0.15 : undefined }}
    >
      {/* Shadow */}
      <rect
        x={rx + 1}
        y={ry + 2}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="rgba(0,0,0,0.06)"
      />
      {/* Node background */}
      <rect
        x={rx}
        y={ry}
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
      {/* Completion circle */}
      <circle
        cx={rx + 16}
        cy={ry + height / 2}
        r={6}
        fill={task.completed ? "#10b981" : "none"}
        stroke={task.completed ? "#10b981" : "#94a3b8"}
        strokeWidth={1.5}
        onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }}
        style={{ cursor: "pointer" }}
      />
      {task.completed && (
        <path
          d={`M${rx + 13} ${ry + height / 2} l2 2 l4 -4`}
          stroke="#fff"
          strokeWidth={1.5}
          fill="none"
          onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }}
          style={{ cursor: "pointer" }}
        />
      )}
      {/* Title */}
      <text
        x={rx + 28}
        y={ry + height / 2}
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#1e293b"
        textDecoration={task.completed ? "line-through" : "none"}
        opacity={task.completed ? 0.5 : 1}
      >
        {task.title}
      </text>
      {/* Collapse/expand chevron for nodes with children */}
      {task.children.length > 0 && (
        <g
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={rx + width - 14}
            cy={ry + height / 2}
            r={8}
            fill="transparent"
          />
          <text
            x={rx + width - 14}
            y={ry + height / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {isCollapsed ? "+" : "-"}
          </text>
        </g>
      )}
      {/* Descendant count badge when collapsed */}
      {isCollapsed && node.descendantCount > 0 && (
        <>
          <rect
            x={rx + width + 4}
            y={ry + height / 2 - 9}
            width={30}
            height={18}
            rx={9}
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth={0.5}
          />
          <text
            x={rx + width + 19}
            y={ry + height / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            +{node.descendantCount}
          </text>
        </>
      )}
    </g>
  );
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

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
}: TreeViewV2Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const nodes = useMemo(() => layoutTree(task, collapsedIds), [task, collapsedIds]);
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
    const paths: { key: string; d: string }[] = [];
    for (const node of nodes) {
      if (node.parentId == null) continue;
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
      });
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
    if (Math.abs(dx - transformRef.current.x) > 3 || Math.abs(dy - transformRef.current.y) > 3) {
      didDrag.current = true;
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
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.scale * factor));
      const ratio = newScale / t.scale;

      setTransform({
        x: cursorX - (cursorX - t.x) * ratio,
        y: cursorY - (cursorY - t.y) * ratio,
        scale: newScale,
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Keyboard shortcuts: F = fit-to-view, Escape = exit focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        fitToView();
      } else if (e.key === "Escape" && focusedTaskId !== null) {
        setFocusedTaskId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fitToView, focusedTaskId]);

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
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: "block" }}
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
            return (
              <SvgNode
                key={node.id}
                node={node}
                isSelected={node.id === selectedTaskId}
                onSelect={() => onSelectTask(node.id)}
                onToggleCompleted={() => onToggleCompleted(node.id, !node.task.completed)}
                relocateStatus={relocateStatus}
                isCollapsed={collapsedIds.has(node.id)}
                onToggleCollapse={() => toggleCollapse(node.id)}
                isFocusDimmed={focusedIds !== null && !focusedIds.has(node.id)}
                onDoubleClick={() => setFocusedTaskId(node.id)}
              />
            );
          })}
        </g>
      </svg>
    </div>
    </>
  );
}
