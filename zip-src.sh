#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------
# Config
# -----------------------------------------
PROJECT_DIR="${1:-.}"       # default to current dir if not given
ZIP_NAME="${2:-angular-src.zip}"

# Patterns to exclude
EXCLUDES=(
  "node_modules/*"
  "dist/*"
  "tmp/*"
  ".angular/*"
  ".git/*"
  ".idea/*"
  ".vscode/*"
  "*.log"
  "package-lock.json"
)

# -----------------------------------------
# Script
# -----------------------------------------
cd "$PROJECT_DIR"

echo "Zipping Angular source from: $(pwd)"
echo "Output archive: $ZIP_NAME"

# Build the exclude arguments for zip
EXCLUDE_ARGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=( -x "$pattern" )
done

# Create the zip
zip -r "$ZIP_NAME" . "${EXCLUDE_ARGS[@]}"

echo "Done: $ZIP_NAME"
