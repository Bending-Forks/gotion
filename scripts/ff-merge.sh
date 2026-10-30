#!/usr/bin/env bash
# Rebase the PR branch on its base and fast-forward the base onto it, keeping the signatures.
# Usage: scripts/ff-merge.sh [pr-number]   (default: the open PR of the current branch)
set -euo pipefail
if [ $# -gt 0 ]; then
  pr=$1
else
  read -ra prs <<< "$(gh pr list --head "$(git branch --show-current)" --json number -q '.[].number' | paste -sd ' ')"
  case ${#prs[@]} in
    0) echo "No open PR for this branch."; exit 1 ;;
    1) pr=${prs[0]} ;;
    *) read -rp "Open PRs for this branch: ${prs[*]}. Which one? " pr ;;
  esac
fi
info=$(gh pr view "$pr" --json headRefName,baseRefName,author -q '"\(.headRefName) \(.baseRefName) \(.author.is_bot)"')
read -r branch base bot <<< "$info"

[ "$bot" = false ] || { echo "Bot PR: merge it with a squash (gh pr merge --squash $pr)."; exit 1; }

git fetch origin
git switch "$branch"
git merge-base --is-ancestor "origin/$branch" HEAD \
  || { echo "$branch is behind origin/$branch: pull it first."; exit 1; }

# The rebase re-signs every commit with your key: ask before doing it to someone else's commits.
if ! git merge-base --is-ancestor "origin/$base" HEAD; then
  me=$(gh api user -q .login)
  others=$(gh pr view "$pr" --json commits -q '.commits[].authors[] | if (.login // "") == "" then .email else .login end' \
    | sort -u | grep -vxF "$me" | paste -sd ' ' || true)
  if [ -n "$others" ]; then
    read -rp "Rebasing re-signs the commits of $others with your key. Go on? [y/N] " answer
    [ "$answer" = y ] || exit 1
  fi
fi
git rebase "origin/$base"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch")" ]; then
  git push --force-with-lease origin "$branch"
  echo "Rebased onto $base: wait for CI and a new approval, then run again."; exit 1
fi

gh pr checks "$pr"
[ "$(gh pr view "$pr" --json reviewDecision -q .reviewDecision)" = APPROVED ] \
  || { echo "PR not approved yet."; exit 1; }

# Pushing the branch head straight to the base: the server takes only a fast-forward,
# and if it refuses, nothing has changed locally.
git push origin "$branch:$base"

echo "Merged #$pr ($branch) into $base. Delete the branch with:"
echo "  git switch $base && git pull --ff-only && git branch -d $branch && git push origin --delete $branch"
