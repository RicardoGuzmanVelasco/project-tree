# project-tree

## What This Is

A visual, persistent, and interactive task tree. Projects are trees — this tool makes that literal.

The tool is being used to manage its own development (dogfooding from day one).

## Product Principles

- **Product over code.** Decisions start from user needs, not implementation convenience.
- **Built for one.** Personal tool, no multi-user, no generalization, no "just in case" features.
- **Abstractions over implementations.** Define the problem first, iterate on solutions.
- **Simplicity is not optional.** No parametrization bloat, no settings pages. Straightforward or nothing.
- **Avoid over-engineering.** If it's not needed right now, don't build it.

## Core Concepts

- **Tree**: The complete, ever-growing representation of a project. Each node is a task. Grows organically. Never closed. You stop where you want on each path.
- **Task**: A node in the tree. Has an auto-incremental ID, a title, and an optional description. Can have children. Completion is independent per task (no cascading).
- **Plan**: A list of task IDs — "this is what we're doing now." Does not modify the tree, just highlights focus. Tree and plan are separate abstractions. A plan has a name and tracks progress (completed/total among its tasks).

## Current State

### Two interfaces

**Web viewer** (`project-tree serve`) — Interactive SVG tree with pan/zoom, collapse, mindmap layout, keyboard shortcuts, and live sync via SSE.

**CLI** (`project-tree <command>`) — Full-featured command line for all tree and plan operations. Unix-friendly (stdout for data, stderr for errors, pipes work cleanly).

### Tree operations (available in both web and CLI)
- **View tree** — Web: interactive SVG. CLI: `print` with depth control, `--hide-completed`, `--ids`
- **Create task** — Web: click + input. CLI: `create <parentId> "title"`
- **Complete/abandon task** — Toggle completion or abandonment
- **Delete task** — Remove task and subtree, with confirmation
- **Relocate task** — Move a task (with subtree) under a different parent
- **Rename task** — Change task title
- **Task descriptions** — Optional text per task. Web: overlay card (D key). CLI: `describe <id>`
- **Prune** — Archive completed/abandoned subtrees into the parent's description

### Plans (available in both web and CLI)
- **Create plan** — Name it, then add tasks to it
- **View plan** — Filters tree to plan tasks only; ancestors shown as structural context
- **Progress** — Web: floating progress bar. CLI: `plans` shows X/N per plan
- **Edit plan** — Add/remove tasks. CLI: `plan add/remove <name> <taskId>`
- **Archive plan** — Hide completed plans
- Plans stored in `.project-tree/plans.json`

### Persistence
- **Data** — `.project-tree/tree.json` and `plans.json` (plain JSON, version-controllable)
- **View state** — localStorage: selected task, show IDs, show minimap, hide completed, collapsed IDs, active plan, zoom/pan transform
- **Live sync** — File watcher + SSE: changes from CLI reflect instantly in the open web viewer

## Tech Stack

- **Monorepo**: Yarn 1.22 (classic) workspaces — `backend/` and `frontend/`
- **Backend**: Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **CLI**: Node.js scripts in `bin/`, consuming shared modules (`tree-ops.ts` + `io.ts`) from backend
- **Tests**: Vitest (backend unit tests + frontend)
- **Typography**: Inter (Google Fonts), fallback to system UI fonts

## Commands

```bash
yarn install                        # Install all dependencies
yarn workspace backend dev          # Start backend dev server
yarn workspace frontend dev         # Start frontend dev server (Vite)
yarn workspace backend build        # Type-check backend
yarn workspace frontend build       # Type-check + bundle frontend
yarn workspace backend test         # Run backend unit tests
project-tree help                   # CLI usage reference
```

## Conventions

- Conventional Commits: `feat:`, `fix:`, `docs:`, `build:`, `test:`, `refactor:`, etc.
- Avoid "add" as the first verb in commit messages — prefer more descriptive verbs.
- Keep commits atomic and concise.
- **Each step/task in a plan gets at least one commit** — a task may have multiple commits if atomically justified, but never batch multiple tasks into one commit.
- **No greenlight needed for commits** — commit directly without asking for approval on the message.
- Always compile/build before pushing.
- Never push without asking first.
- Speak in product terms (tasks, not nodes). Code is implementation detail.

## How to Think About the Task Tree

The task tree follows use case flow, not technical categories. This is critical — getting it wrong means falling into the same traps as every other tool.

### Anti-patterns to avoid

- **No horizontal categories as tasks.** "Documentation", "Dev infrastructure", "Persistence" are NOT tasks. Documentation lives inside whatever task needs it. Persistence lives inside the use case step that needs it. If it cuts across the tree, it's not a node.
- **No technical-first decomposition.** Don't start from "backend needs X, frontend needs Y". Start from the user: what happens first from their perspective? The first step of "View project" is "Frontend requests the tree", not "Server has the tree available" — because the use case starts from the user, and the backend responds to that need.
- **No IDs on use cases or tasks.** They're verbose and a vestige of non-lean thinking. Refer to things by name.
- **No over-atomic use cases.** A use case has an observable result of interest to the user. "Open the app" is not a use case. "View project" is.

### How to decompose a use case into tasks

1. Follow the **use case flow** step by step (from the user's perspective)
2. Each step becomes a **task** (e.g., "Frontend requests the tree", "Server responds with the tree", "Frontend displays the tree")
3. Under each step, list what's needed to **implement the minimum** (e.g., "Create in-memory tree with hardcoded data")
4. Under the same step, list **improvements** to that step (e.g., "Load tree from JSON file on start")
5. The minimum leaves are shippable. The improvements are increments. Both live in the same subtree.

### Zoom is everything

The tree goes from planets to atoms. You zoom in where you need granularity, and leave other branches coarse until you need them. A feature you're not working on might be a single leaf. A feature you're implementing right now might have 4 levels of depth. This is by design — the tree reflects where your attention is.

When focusing on a subtree (e.g., "View project"), treat it as if it were the whole tree. Everything else fades to background.

## Language

- Code, commits, and documentation: **English**
- Conversation with Ricardo: **Spanish** (he communicates in Spanish)
