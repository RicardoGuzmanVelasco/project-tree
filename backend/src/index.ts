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
        {
          id: 3,
          title: "View project",
          children: [
            {
              id: 8,
              title: "Frontend requests the tree",
              children: [
                { id: 14, title: "Create API client function", children: [] },
                { id: 15, title: "Call on app mount", children: [] },
              ],
            },
            {
              id: 9,
              title: "Server responds with the tree",
              children: [
                { id: 16, title: "Define Task type (id, title, children)", children: [] },
                { id: 17, title: "Create in-memory tree with hardcoded sample data", children: [] },
                { id: 18, title: "Expose GET /tasks returning the tree as JSON", children: [] },
                { id: 19, title: "Load tree from JSON file on start", children: [] },
                { id: 20, title: "Seed JSON file with sample data", children: [] },
              ],
            },
            {
              id: 10,
              title: "Frontend displays the tree",
              children: [
                { id: 21, title: "Choose rendering approach (Canvas, SVG, HTML)", children: [] },
                { id: 22, title: "Render nodes with title", children: [] },
                { id: 23, title: "Render parent-child edges", children: [] },
                { id: 24, title: "Render project root as tree origin", children: [] },
              ],
            },
          ],
        },
        {
          id: 4,
          title: "Create task",
          children: [
            {
              id: 11,
              title: "User selects an existing task",
              children: [
                { id: 25, title: "Make nodes clickable/selectable", children: [] },
                { id: 26, title: "Highlight selected task", children: [] },
              ],
            },
            {
              id: 12,
              title: "User provides a title",
              children: [
                { id: 27, title: "Show text input tied to selected task", children: [] },
              ],
            },
            {
              id: 13,
              title: "System creates the task",
              children: [
                { id: 28, title: "Expose POST /tasks with parentId and title", children: [] },
                { id: 29, title: "Validate request (parent exists, title not empty)", children: [] },
                { id: 30, title: "Assign auto-incremental ID", children: [] },
                { id: 31, title: "Insert as child in the in-memory tree", children: [] },
                { id: 32, title: "Persist updated tree to JSON file", children: [] },
              ],
            },
            { id: 33, title: "Tree re-renders with the new task", children: [] },
          ],
        },
      ],
    },
    { id: 5, title: "Edit task", children: [] },
    { id: 6, title: "Delete task", children: [] },
    { id: 7, title: "Plans", children: [] },
    { id: 34, title: "Event sourcing", children: [] },
    { id: 35, title: "Collapse/expand branches", children: [] },
    { id: 36, title: "Serve frontend from backend (remove CORS)", children: [] },
  ],
};

app.get("/tasks", (_req, res) => {
  res.json(tree);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
