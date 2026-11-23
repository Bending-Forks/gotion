# Gotion project instructions for Codex

When the checkout is in the SAPSPENOTION workspace and `../CLAUDE.md` exists, read it first for the shared course context. Read `CLAUDE.md` at the checkout root for Gotion's conventions and workflow. Apply its Git and worktree instructions to Codex sessions. Use Codex's own tools and skill discovery for procedures described there for Claude Code.

## Rules by path

Before editing or reviewing files, read the rules for every affected path, including when the session starts at the repository root.

- For `**/*.go` and `**/go.mod`, read `.claude/rules/go.md`.
- For `services/{account,membership,discussion,notification,editing}/**`, read `.claude/rules/hexagon.md`.
- For files under a service or package, read the applicable Markdown rules in that service or package's `.claude/rules/` directory when it exists. For example, work in `services/editing/` uses `services/editing/.claude/rules/editing.md`.

## Skills

Use the repository skills in `.agents/skills/` according to their descriptions. Each link points to the shared skill folder, including any scripts and references.

## Writing Markdown

Don't hard-wrap prose in Markdown files: each paragraph, list item or table row is one line in the source, however long. Break lines only where Markdown needs it (a new paragraph, list item, heading, table row or code block), never at a fixed column; the renderer wraps the text. When editing a paragraph, keep it on its one line.
