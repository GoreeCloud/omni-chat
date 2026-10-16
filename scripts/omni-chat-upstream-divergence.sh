#!/usr/bin/env bash
# Audits real Git ancestry; a branded fork's own commits are not upstream drift.
set -euo pipefail

fork_ref="${1:-HEAD}"
upstream_ref="${2:-refs/remotes/upstream/main}"
git rev-parse --verify "${fork_ref}^{commit}" >/dev/null
git rev-parse --verify "${upstream_ref}^{commit}" >/dev/null

if ! ancestor="$(git merge-base "$fork_ref" "$upstream_ref")"; then
  echo "No common ancestor between fork and upstream; manual provenance review required." >&2
  exit 2
fi

read -r fork_only upstream_only < <(git rev-list --left-right --count "${fork_ref}...${upstream_ref}")
case "$upstream_only" in
  0) state="Upstream main has no commits outside fork ancestry" ;;
  *) state="Upstream main has new commits requiring selective review" ;;
esac
printf 'Upstream-only commits: %s\n' "$upstream_only"
printf 'Fork-only commits: %s\n' "$fork_only"
printf 'Shared ancestor: %s\n' "$ancestor"
printf 'State: %s\n' "$state"
