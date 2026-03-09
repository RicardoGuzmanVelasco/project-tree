# Navigate tree

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree in V2 mode |
| **Trigger** | User interacts with the tree to navigate |
| **Main flow** | 1. The user pans the tree by dragging with the mouse |
| | 2. The user zooms in/out with the scroll wheel (zoom toward cursor) |
| | 3. The user presses F to fit the entire tree in the viewport |
| | 4. The user collapses/expands branches by clicking the +/- chevron on nodes with children |
| | 5. The user double-clicks a node to focus on its subtree (non-focused branches dim to 0.15 opacity) |
| | 6. A breadcrumb trail appears at the top showing the path to the focused node |
| | 7. The user navigates with keyboard arrows (up/down = siblings, left = parent, right = first child) |
| **Postcondition** | The user has navigated to the area of interest in the tree |
| **Alternative flows** | **Exit focus** — The user presses Escape or clicks "clear" in the breadcrumbs to exit focus mode. |
| | **Minimap** — A 160x100px overview in the bottom-right corner shows all nodes and the current viewport. Click to pan. |
| **Keyboard shortcuts** | V = toggle Classic/V2, F = fit-to-view, +/- = zoom, Space = toggle completion, Escape = deselect or exit focus, Arrow keys = navigate tree structure |
