# Create task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree |
| **Trigger** | User initiates task creation |
| **Main flow** | 1. The user selects an existing task in the tree |
| | 2. The user initiates child creation from the selected task |
| | 3. The user provides a title for the new task |
| | 4. The system assigns an auto-incremental ID and persists the new task as a child of the selected one |
| | 5. The tree re-renders showing the new task in place |
| **Postcondition** | The tree contains a new task under the selected one, with a unique ID and a title |
| **Alternative flows** | **Empty title** — The user tries to confirm without providing a title. The system prevents creation and signals the issue. |
| **Open questions** | 1. Should the tree auto-focus/scroll to the newly created task? |
| | 2. Can you create multiple tasks in quick succession (batch mode) or always one at a time? |
