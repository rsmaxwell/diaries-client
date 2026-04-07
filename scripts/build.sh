#!/bin/bash

set -x

BASEDIR="$(dirname "$0")"
SCRIPT_DIR="$(cd $BASEDIR && pwd)"
SUBPROJECT_DIR="$(dirname $SCRIPT_DIR)"
PROJECT_DIR="$(dirname $SUBPROJECT_DIR)"
BUILD_DIR="${SUBPROJECT_DIR}/build"

. "${BUILD_DIR}/buildinfo"

cd "${SUBPROJECT_DIR}"

# ----------------------------
# Check the environment
# ----------------------------

required_vars=(
  BASEDIR
  SCRIPT_DIR
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: ${var} is not set or empty" >&2
    exit 2
  fi
done

# ----------------------------
# Install "ci"
# ----------------------------
echo "Install 'ci'"
output=$(npm ci 2>&1)
result=$?
if [ ${result} -ne 0 ]; then
    echo "Error: $0[${LINENO}]"
    echo "${output}"
    exit 2    
fi

# ----------------------------
# Build
# ----------------------------
echo "Build"
output=$(npm run build -- --configuration production 2>&1)
result=$?
if [ ${result} -ne 0 ]; then
    echo "Error: $0[${LINENO}]"
    echo "${output}"
    exit 2    
fi
