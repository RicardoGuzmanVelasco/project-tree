import express from "express";

const app = express();
const PORT = 3001;

app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "project-tree" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
