# Gotion project instructions for Codex and agy

When the checkout is in the SAPSPENOTION workspace and `../CLAUDE.md` exists, read it first for the shared course context. Read `CLAUDE.md` at the checkout root for Gotion's conventions and workflow, then `CLAUDE.local.md` next to it if it exists: the private instructions of whoever works in this checkout, kept out of git, which only Claude Code loads by itself.

The private variables of the sessions, such as `NOTION_API_TOKEN` and `NOTION_USER_ID`, are in `.agents/local.env` of the main checkout, which git ignores. Claude Code loads it with a hook; you have them only if the shell that started you loaded it. If a command misses one, say so and ask to be started again after `set -a; . <main checkout>/.agents/local.env; set +a`. Apply its Git and worktree instructions to your sessions. Use your own tools and skill discovery for procedures described there for Claude Code.

## Rules by path

Before editing or reviewing files, read the rules for every affected path, including when the session starts at the repository root.

- For `**/*.go`, `**/go.mod` and `.golangci.yml`, read `.claude/rules/go.md`.
- For `**/*.ts`, `**/*.tsx`, `**/*.mjs`, `**/package.json`, `**/tsconfig*.json` and `.nvmrc`, read `.claude/rules/node.md`.
- For `docs/**`, read `.claude/rules/report.md`.
- For `**/*.md`, read `.claude/rules/markdown.md`.
- For `CLAUDE.md`, `AGENTS.md`, `**/.claude/**` and `.agents/**`, read `.claude/rules/agent-instructions.md`.
- For `services/{account,membership,discussion,notification,editing}/**`, read `.claude/rules/hexagon.md`.
- For files under a service, a package, the web client or `deploy/kubernetes/`, read the Markdown rules in its `.claude/rules/` directory when it exists, State included. For example, work in `services/editing/` uses `services/editing/.claude/rules/editing.md`, work in `client/web/` uses `client/web/.claude/rules/web.md`.

## Skills

Use the repository skills in `.agents/skills/` according to their descriptions. Each link points to the shared skill folder, including any scripts and references.

The `task-batch` skill has each round of review done by a new reviewer. In Claude Code it is the subagent `.claude/agents/reviewer.md`; Codex and agy have no such subagent, so they launch the reviewer with `.claude/skills/task-batch/scripts/task-batch.sh review`, as the skill says.
