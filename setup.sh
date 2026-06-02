#!/bin/bash
# Setup for cloned repo usage (not npm install).
# Run once after cloning to register the `project-tree` CLI globally.

set -e

cd "$(dirname "$0")"
yarn install
yarn build
npm link

echo ""
echo "Done. You can now run 'project-tree' from any project directory."
