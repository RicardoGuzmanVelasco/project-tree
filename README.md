<p align="center">
  <img src="frontend/public/logo.png" alt="project-tree" width="120" />
</p>

<h1 align="center">project-tree</h1>

<p align="center">
  A visual, persistent task tree for any project.<br>
  Projects are trees — this tool makes that literal.
</p>

---

## The idea

Most task tools flatten your work into lists, boards, or backlogs. But projects don't work that way. A feature breaks down into steps. Steps break down into implementation details. Details spawn improvements. It's a tree.

**project-tree** makes the tree the first-class structure. You grow it organically — zoom in where you need granularity, leave other branches coarse until you need them. A feature you're not working on might be a single leaf. A feature you're building right now might be four levels deep.

### Tree vs Plan

The **tree** is everything — the full, ever-growing map of a project. It never closes. You stop where you want on each path.

A **plan** is a selection of tasks from the tree — "this is what we're doing now." It doesn't modify the tree, just highlights focus. Think of it as a spotlight: the tree is the stage, the plan is what's lit.

This separation matters. The tree captures what's possible. The plan captures what's committed. They evolve independently.

## Two interfaces

### Web viewer

Interactive SVG tree with pan, zoom, collapse, mindmap layout, and live sync.

```
project-tree serve
```

Keyboard shortcuts: **I** (show IDs), **D** (description), **G** (go to task), **F** (fit to view), **M** (minimap), **number keys** (collapse to depth).

### CLI

Full-featured command line interface. Unix-friendly — all output goes to stdout, pipes and redirections work cleanly.

```
project-tree print                    # print tree (depth 3)
project-tree print --all              # full tree
project-tree print 42 --ids           # subtree from task #42 with IDs
project-tree print --hide-completed   # only pending tasks

project-tree create 1 "New feature"   # create task under root
project-tree complete 42              # toggle completion
project-tree abandon 42               # toggle abandonment
project-tree delete 42 --force        # delete task and subtree
project-tree rename 42 "Better name"  # rename a task
project-tree move 42 10               # move task under #10
project-tree describe 42              # view description
project-tree describe 42 "Details"    # set description
project-tree prune 42 --force         # archive completed children

project-tree plans                    # list plans with progress
project-tree plan "sprint-1"          # print tree filtered by plan
project-tree plan create "sprint-2"   # create a new plan
project-tree plan add "sprint-2" 42   # add task to plan
project-tree plan add "sprint-2" 42 --recursive  # add task + descendants
project-tree plan remove "sprint-2" 42
project-tree plan remove "sprint-2" 42 --recursive
project-tree plan archive "sprint-2"
```

Run `project-tree help` for the full reference.

## Getting started

```bash
# In any project directory:
project-tree init       # creates .project-tree/ with an empty tree
project-tree serve      # opens the web viewer
```

The `.project-tree/` directory contains `tree.json` and `plans.json` — plain JSON, version-controllable, human-readable.

## Core concepts

- **Task** — A node in the tree. Has an ID, a title, and an optional description. Can have children. Completion is per-task (no cascading).
- **Tree** — The complete task hierarchy. Grows organically. Never "done."
- **Plan** — A named list of task IDs with progress tracking. A lens over the tree, not a copy of it.

## Development

```bash
yarn install                        # install dependencies
yarn workspace backend dev          # dev server with hot reload
yarn workspace frontend dev         # frontend dev server (Vite)
yarn workspace backend build        # compile TypeScript
yarn workspace frontend build       # bundle frontend
yarn workspace backend test         # run unit tests
```

### Tech stack

- **Monorepo**: Yarn classic workspaces — `backend/` and `frontend/`
- **Backend**: Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **CLI**: Node.js scripts in `bin/`, consuming shared modules from the backend
- **Tests**: Vitest

### Architecture

```
bin/
  project-tree.js          # entry point: help, init, serve, dispatch
  commands/
    print.js               # print with depth control
    tasks.js               # create, complete, abandon, delete, rename, move, describe, prune
    plans.js               # plans list, plan CRUD, plan view

backend/src/
  tree-ops.ts              # pure functions: findTask, maxId, countDescendants, isPrunable...
  io.ts                    # disk I/O: readTree, writeTree, readPlans, writePlans
  index.ts                 # Express server, REST API, SSE, file watcher
  types.ts                 # Task and Plan interfaces

frontend/src/              # React SPA with SVG tree visualization
```

The shared modules (`tree-ops.ts` + `io.ts`) are the foundation — both the Express API and the CLI commands consume them. Changes from either interface are picked up by the other via file watching.

## Dogfooding

This tool manages its own development. Run `project-tree print --ids` in this repo to see the full task tree.
