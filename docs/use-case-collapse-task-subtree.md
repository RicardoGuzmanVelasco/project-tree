# Collapse task subtree

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree. A task with children exists. |
| **Trigger** | User clicks the collapse chevron on a task that has children |
| **Main flow** | 1. The user sees a task with children (the task shows a collapse chevron) |
| | 2. The user clicks the chevron |
| | 3. The system collapses the task and all its descendants recursively — every descendant with children is marked as collapsed |
| | 4. The tree re-renders showing only the collapsed task with a badge indicating the total number of hidden descendants (+N) |
| | 5. When the user clicks the chevron again to expand, only the direct children become visible — each descendant that was collapsed remains collapsed, showing its own chevron |
| | 6. The user can progressively expand deeper levels by clicking each descendant's chevron |
| **Postcondition** | The task and all its descendants are collapsed. The navigation state reflects the collapsed IDs. |
| **Alternative flows** | **Task has no children** — No chevron is shown. Nothing to collapse. |
| | **Task is already collapsed** — Clicking the chevron expands it, revealing direct children (each still collapsed). |
| **Notes** | The collapse state is managed as shared navigation state, independent of any specific view implementation. Any view (SVG, HTML, console) can consume this state to determine visibility. The layout algorithm already accepts a `collapsedIds` set — this use case populates it recursively rather than for a single node. |
