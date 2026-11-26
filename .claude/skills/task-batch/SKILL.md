---
name: task-batch
description: Work on the Gotion Tasks Tracker on demand - resume a pull request left "[interrotto]" or pick one to three related Vibecodabile tasks, implement them in a new worktree, open a draft pull request and have it reviewed, round after round, by a reviewer chosen at launch among Claude Code, Codex and agy, with its model and effort. `/task-batch` asks along the way; `/task-batch auto` asks only for the reviewer, then works alone.
argument-hint: "[auto] [--reviewer claude|codex|agy --model <model> --effort <effort>]"
disable-model-invocation: true
model: opus
effort: xhigh
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/task-batch.sh *), Bash(ntn *)
disallowed-tools: mcp__claude_ai_Notion
---

# A batch of Gotion tasks

Resume a pull request left half done, or pick a batch of Vibecodabile tasks from the Gotion Tasks Tracker; implement it in a draft pull request and have it reviewed until a round finds nothing to fix.

## Modes

The arguments are `$ARGUMENTS`; in Codex and agy, the words that follow the name of the skill in the request.

- Without `auto` the mode is interactive: show the batch and have it confirmed before taking it, and ask about every decision that the docs don't settle.
- With `auto`, after the choice of the reviewer ask nothing and wait for no answer: whoever launched you may be gone (`nightly-claude` runs you at night). The decisions that the docs don't settle go into "Decisions to make" in the pull request (see Rules).

Ask with the question tool of your agent: `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_question` in agy; in the chat only when the tool is missing.

## Prerequisites

Check them first; if one is missing, say which and stop.

- `ntn`, the Notion CLI (`curl -fsSL https://ntn.dev | bash`), with the token of a Notion integration connected to the Tasks Tracker in `NOTION_API_TOKEN` and your Notion user in `NOTION_USER_ID` (`ntn api v1/users </dev/null` lists the users): export both in your shell profile. Notion is read and written only through `ntn`, never through a Notion connector, so the changes carry the name of the integration.
- `gh` logged in, `git` with signed commits, `jq` 1.6 or later.
- For the review, at least one of `claude`, `codex` and `agy`, logged in.
- In Codex: `request_user_input` outside Plan mode (`features.default_mode_request_user_input = true` in `~/.codex/config.toml`, or `--enable default_mode_request_user_input`) and the network in the sandbox (`sandbox_workspace_write.network_access = true`), which `gh`, `ntn` and the reviewers need.

Optional variables: `BATCH_POINTS` (default 5), `MAX_TASKS` (3), `REVIEW_ROUNDS` (3). A launcher may also set `TASK_BATCH_CHECK` and `TASK_BATCH_RUN_DIR` (see State and pauses).

## Tools

`task-batch.sh` below is `${CLAUDE_SKILL_DIR}/scripts/task-batch.sh`; in Codex and agy, `.claude/skills/task-batch/scripts/task-batch.sh` of the checkout. Always call it by its full path.

- `task-batch.sh config`: checks `NOTION_API_TOKEN` and `NOTION_USER_ID`, then prints `NOTION_USER_ID`, `GOTION_REPO` (the main checkout), `BATCH_POINTS`, `MAX_TASKS` and `REVIEW_ROUNDS`.
- `task-batch.sh tracker <dir>`: reads the tracker and writes `candidates.json` and `in-progress.json` into the folder; exits with 1 if no task is eligible.
- `task-batch.sh batch <dir> <id>...`: the prefix of the selection that keeps the rules of the batch, with its points.
- `task-batch.sh reviewers [<agent>...]`: the agents that can review, in JSON: for each one its models with their efforts, the suggested model and effort, and the usage of its subscription (`five_hour` and `seven_day` in percent, `resets_at` in epoch seconds, `as_of` the time of the reading when it isn't now; `usage` is `null` when unknown).
- `task-batch.sh check-reviewer <agent> <model> <effort>`: exits with 1, saying why, if that reviewer can't run.
- `task-batch.sh review <agent> <model> <effort> <worktree> <prompt file> <out dir>` starts a reviewer outside the session and returns at once; `task-batch.sh review-wait <out dir>` waits for it up to 9 minutes and prints its verdict, `{"clean": ..., "issues": [...]}`. It exits with 3 and prints `running` if the reviewer is still at work (call it again), with 1 if the reviewer failed.

With `ntn`:

- read a page as Markdown: `ntn pages get <id>`
- read the comments: `ntn api v1/comments block_id==<id> </dev/null`
- find the subpages of a task: `ntn api v1/blocks/<task-id>/children </dev/null` (`child_page` blocks, with their title)
- create a subpage: write the Markdown into a temporary file, with the title in the front matter (`---`, `title: ...`, `---`), then `ntn pages create --parent page:<task-id> --json < file`; the `id` field of the output is the id of the subpage
- rewrite a subpage: `ntn pages edit <subpage-id> < file`
- always add `</dev/null` to an `ntn api` call without a body, or it waits on stdin.

The work folder is `$TASK_BATCH_RUN_DIR` if it is set; otherwise make one with `mktemp -d`. The date of the work is the output of `TZ=Europe/Rome date +%d/%m/%Y`.

## State and pauses

The session can stop at any moment, when the usage runs out or whoever launched it goes away, and what isn't on origin, in the pull request or on Notion is lost. So:

- open the draft pull request as soon as there is the first commit, with a title that starts with `[interrotto] `, and remove the prefix only at the end (step 6);
- push right after every commit;
- keep in the body of the pull request a `## Progress` section with the reviewer and a checklist of one item per task and one per review round, and update it at every step done;
- if `$TASK_BATCH_RUN_DIR` is set, keep `$TASK_BATCH_RUN_DIR/selection.json` up to date: `{"branch": "...", "pr": "<url, once there is one>", "tasks": [{"id": "...", "title": "...", "url": "..."}]}`.

If `$TASK_BATCH_CHECK` is set, run it before every task and every review round. When its output doesn't end with `start`, pause: push, mark in the checklist and in the subpage of each task where you got and the output of the check, leave `[interrotto]` in the title and end with a line that says so. Whoever launched you resumes the session later, or a later launch takes the pull request back at step 1.

## Step 0: the reviewer

If the arguments give `--reviewer`, `--model` and `--effort`, check them with `task-batch.sh check-reviewer`. If they fail and someone can answer, say why and choose as below; if nobody can answer, as under `claude -p`, stop with the reason.

Otherwise run `task-batch.sh reviewers` and ask in two steps:

1. The agent, among those listed, each with its usage, such as "5 h at 38%, week at 61%, reset at 14:30" (`resets_at` in Europe/Rome time). For Codex add the time of the reading (`as_of`), since the value may be old; for agy, "usage unknown".
2. Model and effort of that agent, among those it lists, marking the suggested ones. In Claude Code ask them as two questions of the same call. A question there has at most four options: when the model has more efforts, offer the suggested one and those closest to it, and the user writes the others in "Other".

If no agent is listed, or `REVIEW_ROUNDS` is 0, there is no review: say so, and in `auto` write it in the pull request.

## Step 1: a pull request to resume?

`gh pr list --author @me --state open --json number,title,url,headRefName,createdAt`: the pull requests of this skill have a title that starts with `[interrotto]`. Take the oldest one, however many times it has been resumed already.

If there is one:

1. Enter the worktree of its branch as in step 3, point 1; if the worktree exists already, use it.
2. Rebuild where the work got to: the `## Progress` checklist and the tasks with their Notion links in the body of the pull request, `git log origin/main..HEAD`, the subpage "🤖 task-batch" of each task. Write `selection.json`, if needed, and the reviewer of step 0 in `## Progress`.
3. Go on from the step where the work stopped.

If there is none, go to step 2.

## Step 2: selection

1. `task-batch.sh tracker <dir>`. If it exits with 1 there is nothing to do: report the open blockers it prints and stop.
2. `candidates.json` lists, in timeline order (Due date, then Priority), the Not started Vibecodabile tasks that are free or assigned to `NOTION_USER_ID`. `eligible` is true if all their "Blocked by" are Done, `open_blockers` lists the others, `estimate` is the Effort in story points (1, 2, 3, 5, 8) and `target` the area of the project. `in-progress.json` lists the tasks In progress with their assignees.
3. Compose the batch, which becomes a single pull request:
   - the first task is the first one with `eligible` true in the timeline, whatever its estimate;
   - add another task only if it has the same `target` as the first, if the batch stays within `MAX_TASKS` tasks and `BATCH_POINTS` points, and if it is eligible or has among its `open_blockers` only earlier tasks of the same batch. Don't skip an eligible task with an earlier Due date;
   - the same target is not enough: add it only if it is related to the rest of the batch, that is it touches the same files, the same service, package or chapter of the report, or it continues a task of the batch, so that the same context and the same pull request serve all of them. When in doubt, fewer tasks;
   - a task without `estimate` or `target` goes alone.
4. Don't pick or add a task that needs decisions belonging to a task In progress of another person, such as the folder structure of the services while someone builds the skeleton of the repository. You may read the pages of the tasks In progress.
5. Read the body of the page of every task you consider, with its closing criteria and links, and its comments. In `auto`, confirm that it can be done without a person answering: a doubt that the documentation in `docs/` settles is no obstacle. If a task can't be done, drop it and move to the next one of the timeline.
6. `task-batch.sh batch <dir> <id>...`, with the ids in the order you will work on them: keep only the tasks it returns.
7. In interactive mode show the batch, with titles, points and why the tasks belong together, and have it confirmed or changed.
8. Choose the name of the branch: `<type>/<slug>`, with the type among feat, fix, docs, ci, build, test, refactor and chore as in Conventional Commits, and a short English slug, lowercase, with hyphens.
9. Set every task In progress and assign it to `NOTION_USER_ID`, then write `selection.json`:

   ```bash
   ntn api v1/pages/<task-id> -X PATCH </dev/null \
     -d '{"properties":{"Status":{"status":{"name":"In progress"}},"Assignee":{"people":[{"id":"<NOTION_USER_ID>"}]}}}'
   ```

## Step 3: worktree and draft pull request

1. `<GOTION_REPO>/scripts/new-worktree.sh <branch>` creates the worktree `gotion-<slug>` next to `GOTION_REPO`, on the branch if it exists already, and runs `npm install`. In Claude Code enter it with the EnterWorktree tool and its `path`, so the `CLAUDE.md`, the rules and the skills of the project load from there; elsewhere, work with absolute paths inside the worktree. From here on, work only there.
2. Under the page of every task create, if there isn't one already, a subpage "🤖 task-batch <date>" with the plan of the work and the status "🚧 in corso".
3. After the first commit: `git push -u origin <branch>`, then `gh pr create --draft --base main` with a title that starts with `[interrotto] ` followed by a title in Conventional Commits. In the body, in English: the tasks, each with the link to its Notion page (from there the `notion.yml` workflow links the pull request to the tasks), the `## Progress` section and "Work in progress". Add `pr` to `selection.json`.

## Step 4: work

For every task, in order:

1. Run `$TASK_BATCH_CHECK`, if set.
2. Read the body of the page of the task, with its closing criteria and links, and its comments. Then read the code and the report that the task touches. Follow `CLAUDE.md` and `CLAUDE.local.md`, if there.
3. Make a signed commit, with a title in Conventional Commits, at every step done, then push and update the checklist.

If a task can't be finished, write what is missing and move to the next one. At the end run locally the checks of the CI (`.github/workflows`) that can run here, and update the body of the pull request: the tasks with their Notion links, what you did, what is missing and, only if needed, a "Decisions to make" section.

## Step 5: review

Up to `REVIEW_ROUNDS` rounds, each with a new reviewer launched from the worktree. At every round:

1. Run `$TASK_BATCH_CHECK`, if set.
2. Launch the reviewer and wait for its answer:
   - if the reviewer is Claude and you run in Claude Code: a new subagent of type `reviewer`, with the chosen model and effort, not in the background. In the prompt: the round (n of `REVIEW_ROUNDS`), the worktree, the branch, the URL of the pull request and the tasks with their ids and Notion links. It answers `NOTHING TO FIX` or with a numbered list of problems;
   - otherwise: write into a file the round, the worktree, the branch, the URL of the pull request, then for each task its id, its Notion link, the text of its page and its comments, then the body of the pull request, since the sandbox of Codex has no network. Run `task-batch.sh review <agent> <model> <effort> <worktree> <file> <dir>` with a new folder for every round, then `task-batch.sh review-wait <dir>` again and again until it doesn't exit with 3. If the reviewer fails, launch it once more; if it fails again, write it in the pull request and end the review.
3. If the answer is clean (`NOTHING TO FIX`, or `"clean": true`), the review is over. Otherwise fix the concrete problems with signed commits in Conventional Commits, push, and mark the round in the checklist. If a problem doesn't convince you, don't fix it by force: write why in the body of the pull request.

If problems are still open after the last round, list them in the body of the pull request.

## Step 6: end

1. Rewrite the subpage of every task with a summary in Italian: what you did, the branch, the link of the pull request, the reviewer and the number of rounds, the decisions to make, what is missing. Remove the status "🚧 in corso".
2. Fill the page of the pull request in the Pull Requests database of Notion with the `pr-page` skill.
3. Remove `[interrotto] ` from the title of the pull request (`gh pr edit <number> --title ...`).
4. Only in `auto`, leave on every task a comment that mentions `NOTION_USER_ID`, who gets it as a notification:

   ```bash
   jq -n --arg page <task-id> --arg user <NOTION_USER_ID> \
     --arg text " 🤖 task-batch del <date> ha finito: draft PR <url>, rivista da <reviewer> in <n> giri. Il riassunto è nella sottopagina 🤖 task-batch." \
     '{parent: {page_id: $page}, rich_text: [{type: "mention", mention: {user: {id: $user}}}, {type: "text", text: {content: $text}}]}' \
     | ntn api v1/comments
   ```

## Rules

- In `auto` nobody will answer your doubts: look for the answer in the documentation of the project in `docs/` (requirements and quality attributes of the analysis, design, ADRs in `docs/_includes/adr.md`, implementation, DevOps) and in `CLAUDE.md`, and infer what the team would answer from the decisions already made. Follow them even where you would have chosen otherwise: don't contradict an ADR, a convention or an example already written in the docs.
- If the docs aren't enough, or the description of the task contradicts them: in interactive mode ask; in `auto` choose the most prudent and reversible option consistent with the decisions already made, and put it among the "Decisions to make" of the pull request, with what you chose, the alternative and the parts of the docs you relied on. Don't write "Proposed" ADRs.
- Don't mark any task Done, don't touch `main`, don't merge, don't use `scripts/ff-merge.sh`, don't change tasks other than these and don't touch pull requests other than this one.
- The texts on Notion (subpages, comments) are in Italian, like the rest of the workspace; the body of the pull request is in English. When you write or change the text of the report in `docs/`, the body of the pull request or the summaries on Notion, pass it through the `humanizer` skill, if available, before saving it.
- Don't install software on the system (brew, dnf, `npm -g`, `go install` and the like): use the tools that are there and, if one is missing, write it in the pull request among the things missing.
