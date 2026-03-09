# Complete task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree |
| **Trigger** | User toggles completion on a task |
| **Main flow** | 1. The user selects a task in the tree |
| | 2. The user marks it as completed |
| | 3. The system persists the new state |
| | 4. The tree re-renders showing the task as completed |
| **Postcondition** | The task's completion state is updated and visually reflected |
| **Alternative flows** | **Uncomplete** — The user toggles a completed task back to incomplete. Same flow. |
| **Open questions** | 1. Should completed tasks look different from their children's perspective? (e.g., if a parent is done but a child isn't) |
| | 2. Should there be a way to hide/filter completed tasks? (probably future, related to collapse/expand) |
