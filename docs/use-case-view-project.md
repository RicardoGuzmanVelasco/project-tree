# View project

| | |
|---|---|
| **Actor** | User |
| **Precondition** | The application is running |
| **Trigger** | User opens the application |
| **Main flow** | 1. The system retrieves the persisted task tree |
| | 2. The system renders the tree visually, with the project root and all its descendants |
| | 3. The user sees the full project structure at a glance |
| **Postcondition** | The user has a visual representation of the entire project tree on screen |
| **Alternative flows** | **Empty project** — If the tree has no tasks yet, the system shows only the project root with no children |
| **Open questions** | Can the user interact with the tree from this view (e.g., click a node to create a child)? Or is creation a separate flow entirely? |
