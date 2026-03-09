# Relocate task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree with at least two tasks |
| **Trigger** | User initiates relocation of a selected task |
| **Main flow** | 1. The user selects a task in the tree |
| | 2. The user initiates relocation (clicks "Relocate") |
| | 3. The system enters relocation mode — valid target parents are highlighted, invalid ones (descendants of the task, the task itself) are dimmed |
| | 4. The user clicks a valid task to set it as the new parent |
| | 5. The system moves the task (with its entire subtree) under the new parent |
| | 6. The tree re-renders showing the task in its new position |
| **Postcondition** | The task and its subtree are children of the new parent. The old parent no longer references it. |
| **Alternative flows** | **Target is a descendant** — The descendant is visually dimmed and not clickable. The system prevents the move (would create a cycle). |
| | **Target is the current parent** — The system treats it as a no-op and exits relocation mode. |
| | **Task is the root** — The "Relocate" button is not shown. Root cannot be relocated. |
| | **User cancels** — The user presses ESC or clicks "Cancel". The system exits relocation mode without changes. |
| **Open questions** | 1. Should there be control over position within siblings (ordering), or always append at the end? |
