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
- **Task**: A node in the tree. Has an auto-incremental ID and a title. Can have children.
- **Plan** (future): A selection of subtrees — "this is what we're doing now." Does not modify the tree, just highlights focus. Tree and plan are separate abstractions.

## Current State: MVP

The MVP is the first "plan" of the project itself. Scope:

- **View project** — See the full task tree at a glance
- **Create task** — Select any task, create a child under it

That's it. No edit, no delete, no plans yet. See `docs/` for detailed use cases.

## Tech Stack

- **Monorepo**: Yarn 1.22 (classic) workspaces — `backend/` and `frontend/`
- **Backend**: Express + TypeScript (port 3001)
- **Frontend**: React + TypeScript + Vite (port 5173)
- **No linter/formatter** — intentional, can be added later as a task in the tree

## Commands

```bash
yarn install                        # Install all dependencies
yarn workspace backend dev          # Start backend (http://localhost:3001)
yarn workspace frontend dev         # Start frontend (http://localhost:5173)
yarn workspace backend build        # Type-check backend
yarn workspace frontend build       # Type-check + bundle frontend
```

## Conventions

- Conventional Commits: `feat:`, `fix:`, `docs:`, `build:`, `test:`, `refactor:`, etc.
- Avoid "add" as the first verb in commit messages — prefer more descriptive verbs.
- Keep commits atomic and concise.
- Always compile/build before pushing.
- Never push without asking first.
- Speak in product terms (tasks, not nodes). Code is implementation detail.

## Language

- Code, commits, and documentation: **English**
- Conversation with Ricardo: **Spanish** (he communicates in Spanish)
