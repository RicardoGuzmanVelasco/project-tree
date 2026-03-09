import { useMemo } from "react";
import { Task } from "./types";
import { layoutTree, LayoutNode } from "./treeLayout";

interface TreeViewV2Props {
  task: Task;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  relocatingTaskId: number | null;
}

function SvgNode({
  node,
  isSelected,
  onSelect,
  onToggleCompleted,
}: {
  node: LayoutNode;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCompleted: () => void;
}) {
  const { x, y, width, height, task } = node;
  const rx = x - width / 2;
  const ry = y;

  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={isSelected ? "#dbeafe" : "#fff"}
        stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
        strokeWidth={isSelected ? 2 : 1}
        opacity={task.completed ? 0.5 : 1}
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
        fontSize={14}
        fill="#1e293b"
        textDecoration={task.completed ? "line-through" : "none"}
        opacity={task.completed ? 0.5 : 1}
      >
        {task.title}
      </text>
    </g>
  );
}

export default function TreeViewV2({
  task,
  selectedTaskId,
  onSelectTask,
  onToggleCompleted,
}: TreeViewV2Props) {
  const nodes = useMemo(() => layoutTree(task), [task]);

  // Compute SVG viewBox from layout bounds
  const padding = 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const left = n.x - n.width / 2;
    const right = n.x + n.width / 2;
    const top = n.y;
    const bottom = n.y + n.height;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  return (
    <div style={{ width: "100%", height: "calc(100vh - 120px)", overflow: "hidden" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        style={{ display: "block" }}
      >
        {nodes.map((node) => (
          <SvgNode
            key={node.id}
            node={node}
            isSelected={node.id === selectedTaskId}
            onSelect={() => onSelectTask(node.id)}
            onToggleCompleted={() => onToggleCompleted(node.id, !node.task.completed)}
          />
        ))}
      </svg>
    </div>
  );
}
