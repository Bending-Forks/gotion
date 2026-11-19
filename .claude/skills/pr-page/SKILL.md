---
name: pr-page
description: Write or rewrite the body of the Notion page of a Gotion pull request, in the Pull Requests database, with an Italian summary passed through the humanizer skill, the files touched with their lines, and each commit in plain words with its files and lines. Use it right after opening a pull request or pushing to one (rebase included), or when asked to fill or refresh the page of a PR.
---

# The page of a pull request on Notion

The `notion.yml` workflow creates a page for each pull request in the Pull Requests database (data source `41df720c-4b16-8170-9dac-000beab87160`) and keeps its properties in step with GitHub. It never touches the body: this skill writes it. Rewrite the whole body every time, since a push or a rebase changes the commits.

The body is in Italian, like the rest of the Notion workspace, even though the repo is in English.

1. **Facts.** Run `.claude/skills/pr-page/facts.sh <N> > "$f"`, with `f=$(mktemp -d)/page.md`. It prints the body with the exact files and lines of the PR and of each commit, plus two placeholders: `_(riassunto)_` and one `_(descrizione)_` per commit. Leave the numbers, the file lists and the headings as they are.
2. **Read the PR.** Its description (`gh api repos/Bending-Forks/gotion/pulls/<N> --jq .body`), the full message of each commit, and the diff (`gh api repos/Bending-Forks/gotion/pulls/<N> -H 'Accept: application/vnd.github.diff'`, or `git diff` on a local checkout). Use only the REST API through `gh api`: `gh pr` needs GraphQL, which some environments block.
3. **Write the text.**
   - In place of `_(riassunto)_`: three to five sentences on what the PR changes and why, for a reader who hasn't seen the code. Name the parts of the project it touches, not the files: the file table follows.
   - In place of each `_(descrizione)_`: one short sentence, in plain words, on what that commit does. Prefer an everyday word to a technical one when both work.
   - Put file and folder names in backticks even in the prose: Notion turns a bare `CLAUDE.md` into a link to a website.
4. **Humanize.** Pass the summary and the descriptions through the humanizer skill (the `humanizer` plugin that `.claude/settings.json` enables), then put the result back in the file.
5. **Find the page.** Query the data source with the filter `{"filter":{"property":"Number","number":{"equals":<N>}}}`: with the Notion MCP, or with `ntn api v1/data_sources/41df720c-4b16-8170-9dac-000beab87160/query -d '<filter>'`. The page id is in `results[0].id`. If there is no page yet, the workflow is still creating it: wait 30 seconds and try again, up to three times.
6. **Write the page.** With the Notion MCP, `notion-update-page` with `replace_content` and the content of the file; otherwise `ntn pages edit <page-id> < "$f"`. Don't change the properties: the workflow owns them.
