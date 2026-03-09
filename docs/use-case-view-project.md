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
| **Notes** | Two view modes available: Classic (HTML-based) and V2 (SVG with pan/zoom). Toggle with V key or toolbar button. Both views support selection, creation, completion, deletion, and relocation. |
