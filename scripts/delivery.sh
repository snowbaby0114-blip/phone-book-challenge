#!/usr/bin/env bash
# Packages your work for submission. See scripts/delivery.mjs for details.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found on your PATH." >&2
  echo "Node 18 or newer is a prerequisite of this project - install it and run this script again." >&2
  echo "If you cannot install Node, email tech.challenge@eyecarepro.net and we will" >&2
  echo "arrange another way to receive your work." >&2
  exit 1
fi

exec node "$(dirname "$0")/delivery.mjs" "$@"
