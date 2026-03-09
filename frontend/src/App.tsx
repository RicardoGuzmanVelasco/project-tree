import { useEffect, useState } from "react";
import { fetchTree } from "./api";
import { Task } from "./types";
import TreeView from "./TreeView";

export default function App() {
  const [tree, setTree] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchTree()
      .then(setTree)
      .catch(() => setError("Could not load tree"));
  }, []);

  if (error) return <p>{error}</p>;
  if (!tree) return <p>Loading...</p>;

  return (
    <TreeView
      task={tree}
      selectedTaskId={selectedTaskId}
      onSelectTask={setSelectedTaskId}
    />
  );
}
