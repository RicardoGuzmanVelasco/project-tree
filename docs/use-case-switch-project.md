# Switch project

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The application is running with multiple projects available |
| **Trigger** | User selects a different project from the project selector dropdown |
| **Main flow** | 1. The system displays a dropdown in the toolbar listing all available projects |
| | 2. The user selects a project from the dropdown |
| | 3. The system resets all navigation state (collapsed nodes, depth level, hide completed, revealed parents) |
| | 4. The system clears the current selection and any in-progress actions (relocate, delete) |
| | 5. The system loads the selected project's task tree |
| | 6. The user sees the new project's tree |
| **Postcondition** | The user is viewing a different project's task tree with a clean navigation state |
| **Alternative flows** | **Default project** — On initial load, the system defaults to the "project-tree" project |
| **Notes** | Each project has independent ID spaces. Projects are stored as separate JSON files in `backend/data/trees/`. Creating new projects via UI is deferred — projects are created manually as files. |
