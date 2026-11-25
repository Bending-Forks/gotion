# Gotion project instructions for Codex

When the checkout is in the SAPSPENOTION workspace and `../CLAUDE.md` exists, read it first for the shared course context. Read `CLAUDE.md` at the checkout root for Gotion's conventions and workflow. Apply its Git and worktree instructions to Codex sessions. Use Codex's own tools and skill discovery for procedures described there for Claude Code.

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
