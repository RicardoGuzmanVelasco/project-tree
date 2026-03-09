# Create task

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The user is viewing the project tree |
| **Trigger** | User initiates task creation |
| **Main flow** | 1. The user selects an existing task in the tree |
| | 2. A text input appears in the toolbar |
| | 3. The user types a title and presses Enter or clicks Create |
| | 4. The system assigns an auto-incremental ID and persists the new task as a child of the selected one |
| | 5. The tree re-renders showing the new task in place |
| **Postcondition** | The tree contains a new task under the selected one, with a unique ID and a title |
| **Alternative flows** | **Empty title** — The system ignores the creation request if the title is empty. |
| **Notes** | Tasks are created one at a time. The input clears after creation, ready for the next one. |
