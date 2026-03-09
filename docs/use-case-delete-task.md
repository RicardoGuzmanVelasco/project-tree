# Delete task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree with a non-root task selected |
| **Trigger** | User clicks the Delete button |
| **Main flow** | 1. The user selects a task in the tree (not the root) |
| | 2. The user clicks "Delete" in the toolbar |
| | 3. **Leaf task (no descendants):** the system deletes it immediately |
| | 4. **Task with descendants:** the system enters progressive confirmation — the button turns red and shows the number of remaining clicks needed (equal to the number of descendants) |
| | 5. The user clicks the required number of times to confirm |
| | 6. The system deletes the task and its entire subtree |
| | 7. The tree re-renders without the deleted subtree |
| **Postcondition** | The task and all its descendants are removed. Selection is cleared. |
| **Alternative flows** | **User cancels** — The user presses Escape or selects a different task. Confirmation resets. |
| | **Root task** — The Delete button is not shown. The root cannot be deleted. |
| **Notes** | Progressive confirmation requires N clicks where N = number of descendants. This makes deleting large subtrees a deliberate act proportional to their size. |
