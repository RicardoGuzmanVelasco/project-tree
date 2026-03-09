# Complete task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree |
| **Trigger** | User toggles completion on a task |
| **Main flow** | 1. The user clicks the completion circle on any task (no selection required) |
| | 2. The system persists the new state |
| | 3. The tree re-renders showing the task as completed (reduced opacity, strikethrough title, green circle) |
| **Postcondition** | The task's completion state is updated and visually reflected |
| **Alternative flows** | **Uncomplete** — The user clicks the completion circle on a completed task to toggle it back. Same flow. |
| **Notes** | Completion is independent per task — completing a parent does not cascade to children, and vice versa. |
