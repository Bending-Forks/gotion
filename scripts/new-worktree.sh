#!/usr/bin/env bash
# Create a git worktree next to this repo for a task branch: the existing branch (local or on origin)
# if there is one, otherwise a fresh branch from origin/main.
# Usage: scripts/new-worktree.sh <type>/<task>   e.g. scripts/new-worktree.sh docs/hexagonal
set -euo pipefail

branch=${1:-}
[[ $branch == ?*/?* ]] || { echo "usage: $0 <type>/<task>   e.g. $0 docs/hexagonal" >&2; exit 1; }

repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
dir=$(dirname "$repo")/$(basename "$repo")-${branch#*/}

warn() { echo "warning: $*" >&2; }
has() { git -C "$repo" rev-parse -q --verify "$1" >/dev/null; }

git -C "$repo" fetch --prune origin
local_ref=refs/heads/$branch remote_ref=refs/remotes/origin/$branch
if has "$local_ref"; then
  if ! has "$remote_ref"; then
    warn "using existing $branch, found only locally: never pushed, or deleted on origin (merged PR?)"
  else
    read -r ahead behind < <(git -C "$repo" rev-list --left-right --count "$local_ref...$remote_ref")
    if ((ahead || behind)); then
      warn "using existing local $branch, which differs from origin: $ahead ahead, $behind behind"
    else
      warn "using existing $branch, local and origin in sync"
    fi
  fi
  git -C "$repo" worktree add "$dir" "$branch"
elif has "$remote_ref"; then
  warn "using existing $branch from origin, tracked by a new local branch"
  git -C "$repo" worktree add "$dir" "$branch"
else
  warn "$branch not found locally or on origin: creating it from origin/main"
  git -C "$repo" worktree add --no-track "$dir" -b "$branch" origin/main
fi
(cd "$dir" && npm install)
[[ -f $repo/CLAUDE.local.md ]] && cp "$repo/CLAUDE.local.md" "$dir/"

echo
echo "Ready. Now run:"
echo "  cd $dir && claude"
