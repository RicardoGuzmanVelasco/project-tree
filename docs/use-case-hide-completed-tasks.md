# Hide completed tasks

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree. Some tasks are marked as completed. |
| **Trigger** | User clicks the "Hide completed" toggle in the navigation toolbar |
| **Main flow** | 1. The user activates "Hide completed" via the toolbar toggle |
| | 2. All completed tasks disappear from the tree, grouped into a badge on their parent |
| | 3. Each parent with hidden completed children shows a "+N done" badge |
| | 4. The user clicks a "+N done" badge to reveal the completed children of that specific parent |
| | 5. The user can click the badge again to re-hide them |
| | 6. The user deactivates the toggle to show all tasks again |
| **Postcondition** | Completed tasks are hidden globally, with per-parent opt-in to reveal them. |
| **Alternative flows** | **All children completed** — Parent appears as a leaf with only the "+N done" badge. |
| | **Completed parent with uncompleted children** — Parent remains visible (styled as completed). Its uncompleted children remain visible. Its completed children go to the badge. |
| | **Toggle off** — All tasks become visible again. Per-parent reveal state resets. |
| **Notes** | This is orthogonal to collapse state. A collapsed branch hides children by structure; hide-completed hides by status. Both can be active simultaneously without conflict. The "+N done" badge follows the same interaction pattern as the collapse badge for consistency. State is managed in the shared navigation hook. |
