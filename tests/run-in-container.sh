#!/usr/bin/env bash
# Runs Playwright inside the official Ubuntu image (same version as package.json).
# Needed on hosts where Playwright's WebKit build cannot launch natively (e.g. Arch/CachyOS: libicu74, libflite).
# The repo is mounted at the same absolute path so file:// URLs match the host.
# Usage: tests/run-in-container.sh [playwright test args...]   e.g. --project=webkit-http --project=webkit-file
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/node_modules/@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"
exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI= \
  -v "$ROOT:$ROOT" -w "$ROOT" \
  "$IMAGE" \
  npx playwright test -c tests/playwright.config.mjs "$@"
