# project-tree

## The Problem

Project tasks are inherently a tree (or a DAG, if you don't count the project itself as a universal root). Every project is a hierarchy of work that branches and deepens as you learn more about it. Yet every tool on the market — Jira, Linear, Asana, you name it — flattens that structure into lists, boards, and navigation menus. The tree disappears behind UI layers, and with it, the ability to see where your project actually stands at a glance.

On top of that, existing tools operate with a broken completeness model: "100% of subtasks done = parent done". That ignores the reality that a task tree is theoretically infinite — you could keep refining any branch forever — and that shipping something valuable only requires a subset of that tree, not all of it.

## The Vision

A tool where a project **is** its tree. Literally: you see a visual tree, and that's your project.

- **The tree** is the complete, ever-growing representation of the project. It grows organically as you learn. It's never closed. You stop wherever you want on each path.
- **A plan** (future feature) is simply a selection of subtrees: "this is what we're doing now." It doesn't modify or hide the rest of the tree — it just highlights a focus area.
- **Two natural views** emerge: see a plan (how the current focus is going) and see the full tree (the entire territory, bird's-eye view).

The tree and the plan are separate abstractions. The tree is accumulated knowledge. The plan is a decision about what to act on.

## Design Principles

- **Product over code.** Every decision starts from what the user needs, not from what's convenient to implement.
- **Built for one.** This is a personal tool born from a personal need. No generalization, no multi-user features, no "just in case" functionality. What I need, period.
- **Dogfooding from day one.** The tool is used to manage its own development. The MVP must be minimal enough to make this possible immediately.
- **Abstractions over implementations.** Start from the problems to solve, not from the how. Solutions will be iterated.
- **Simplicity is not optional.** No parametrization bloat, no settings pages, no feature flags. Straightforward or nothing.

## MVP Definition

A visual, persistent, and interactive task tree. Nothing more.

- Create nodes (tasks)
- Create children under any node
- Mark tasks as completed (toggle on/off)
- See the result as an actual tree (not nested lists)
- Data persists between sessions

With that, the project's own development can be modeled and navigated as a tree. Plans come later, managed from the tree itself.

## Other Decisions

- **Node IDs**: Auto-incremental integers. Simple, good enough for now. Can be revisited later.

---

## Tech Stack

- **Monorepo**: Yarn 1.22 (classic) workspaces
- **Backend**: Express + TypeScript (port 3001)
- **Frontend**: React + TypeScript + Vite (port 5173)
- **No linter/formatter configured yet** — can be a task in the tree itself

## Project Structure

```
project-tree/
├── backend/
│   ├── src/
│   │   └── index.ts          # Express server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
└── package.json               # Root with yarn workspaces
```

## Getting Started

```bash
yarn install

# Start backend
yarn workspace backend dev     # http://localhost:3001

# Start frontend
yarn workspace frontend dev    # http://localhost:5173
```

## Technical Decisions

| Decision | Rationale |
|---|---|
| Yarn classic over npm/pnpm | Simple workspace support, no extra config needed |
| Vite over CRA/Next | Fastest dev server for a pure SPA — no SSR needed |
| Express over Fastify/Hono | Most ecosystem support, familiar, good enough for REST API |
| TypeScript on both sides | Type safety across the full stack from day one |
| Monorepo over separate repos | Shared tooling, atomic commits, simpler local dev |
| No linter yet | Avoid yak-shaving — can be a task in the tree itself |
