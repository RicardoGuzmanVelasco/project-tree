import express from "express";
import cors from "cors";
import { Task } from "./types";

const app = express();
const PORT = 3001;

app.use(cors());

const tree: Task = {
  id: 1,
  title: "project-tree",
  children: [
    {
      id: 2,
      title: "MVP",
      children: [
        { id: 3, title: "View project", children: [] },
        { id: 4, title: "Create task", children: [] },
      ],
    },
    { id: 5, title: "Edit task", children: [] },
    { id: 6, title: "Delete task", children: [] },
    { id: 7, title: "Plans", children: [] },
  ],
};

app.get("/tasks", (_req, res) => {
  res.json(tree);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
