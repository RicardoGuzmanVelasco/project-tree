# Collapse to depth level

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree. The tree has at least two levels of depth. |
| **Trigger** | User adjusts the depth level via the stepper control in the navigation toolbar, or presses a number key (1-9) |
| **Main flow** | 1. The navigation toolbar displays a stepper control labeled "Collapse from lvl" with the current depth value |
| | 2. The stepper is bounded: minimum is 1 (root level), maximum is the deepest level present in the tree |
| | 3. The user increments or decrements the level using the stepper arrows |
| | 4. The system collapses every task whose depth is greater than or equal to the selected level (and that has children) |
| | 5. Tasks above the selected depth remain expanded |
| | 6. The tree re-renders reflecting the new collapse state |
| **Postcondition** | All tasks at or beyond the selected depth are collapsed. Tasks above remain expanded. |
| **Alternative flows** | **Number key shortcut** — The user presses a number key (1-9) to directly set the collapse depth level. Same effect as using the stepper. |
| | **Depth exceeds tree** — If the selected depth exceeds the maximum tree depth, all tasks are expanded (nothing to collapse). |
| **Notes** | The stepper dynamically adjusts its maximum based on the actual tree depth. The collapse state is managed via shared navigation state, so both views reflect the change identically. This operation replaces the current collapsed IDs entirely — it is not additive to manual per-task collapses. |
