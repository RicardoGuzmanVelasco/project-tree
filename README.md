# project-tree

Visual, persistent, interactive task tree for any project.

## Setup (cloned repo)

```bash
git clone https://github.com/RicardoGuzmanVelasco/project-tree.git
cd project-tree
./setup.sh
```

## Usage

```bash
cd ~/my-project
project-tree init    # first time: creates .project-tree/
project-tree         # opens the viewer in your browser
```

### Options

| Flag | Description |
|------|-------------|
| `--port 3005` | Use a different port (default: 3001) |
| `--no-open` | Don't open the browser |
| `--dir path/` | Point to a different data directory |

### Data

Each project keeps its tree in a `.project-tree/` folder:

```
my-project/
├── src/
├── .project-tree/
│   ├── tree.json
│   └── plans.json
└── ...
```

This folder is meant to be committed to git — the tree travels with the project.
