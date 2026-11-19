#!/usr/bin/env bash
# Prints the body of the Notion page of pull request N as Markdown, with the files and lines of the PR and of each of its
# commits, and two placeholders for the text that the pr-page skill writes: _(riassunto)_ and _(descrizione)_.
# Uses only the REST API through gh api, which also works where GraphQL is blocked.
set -euo pipefail
n=${1:?usage: facts.sh <PR number>}
repo=${GH_REPO:-Bending-Forks/gotion}
api() { gh api "repos/$repo/$1" --paginate --jq "$2"; }

# The first line of the commit message, with file names in backticks: Notion turns a bare CLAUDE.md into a link
title='.commit.message | split("\n")[0] | gsub("(?<!`)(?<f>[A-Za-z0-9_./-]+\\.[A-Za-z]{1,6})(?![A-Za-z0-9`])"; "`\(.f)`")'

# total FILE_TSV: "N file, +A −D" from lines "path<TAB>additions<TAB>deletions"
total() { [[ -n $1 ]] || { printf "0 file"; return; }; awk -F'\t' '{ a += $2; d += $3 } END { printf "%d file, +%d −%d", NR, a, d }' <<<"$1"; }

files=$(api "pulls/$n/files" '.[] | [.filename, .additions, .deletions] | @tsv')
printf '## Riassunto\n\n_(riassunto)_\n\n## File toccati\n\n%s\n\n| File | + | − |\n| --- | --- | --- |\n' "$(total "$files")"
awk -F'\t' '{ printf "| `%s` | %d | %d |\n", $1, $2, $3 }' <<<"$files"

printf '\n## Commit\n'
for sha in $(api "pulls/$n/commits" '.[].sha'); do
  commit=$(gh api "repos/$repo/commits/$sha")
  files=$(jq -r '.files[] | [.filename, .additions, .deletions] | @tsv' <<<"$commit")
  printf '\n### `%s` %s\n\n_(descrizione)_\n\n%s: %s\n' "${sha:0:7}" "$(jq -r "$title" <<<"$commit")" \
    "$(total "$files")" "$(awk -F'\t' '{ printf "%s`%s` (+%d −%d)", (NR > 1 ? ", " : ""), $1, $2, $3 }' <<<"$files")"
done
