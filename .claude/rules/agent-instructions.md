---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - "**/.claude/**"
  - ".agents/**"
---

# Instructions for Claude Code and Codex

- `CLAUDE.md` holds only what every session needs. What holds in one area of the repository is a rule with `paths:` in `.claude/rules/`: `go.md`, `hexagon.md` (the five services with a hexagon), `node.md`, `markdown.md`, `report.md` and this one. What holds in one package is in `<package>/.claude/rules/<package>.md`, which loads when Claude touches a file of that package and ends with the State of the package: what is done and what is missing. A `.claude/CLAUDE.md` or `.claude/settings.json` inside a package is read only when Claude is started from that folder, so don't use them.
- The procedures the project repeats are skills: `domain-event`, `fitness-function`, `test-strategy`, `observability`, `deployment` and `pr-page` in `.claude/skills/`; `aggregate` and `service-contract` in `services/.claude/skills/` and `ci-cd` in `.github/.claude/skills/`, which load the first time Claude touches a file in that folder.
- `golang-concurrency` and `golang-safety` in `.claude/skills/` are copies of samber/cc-skills-golang at commit `d68d80a` (MIT, the `LICENSE` is next to each), which load with the first Go file; the copies drop the `allowed-tools` line, so the permissions of the project apply. To update them, copy them again and drop that line.
- The root `.claude/settings.json` enables the Superpowers plugin and the `humanizer` plugin, which `pr-page` uses; the README says how to install them.
- Codex reads `AGENTS.md`, which lists the rules by path by hand, and finds the skills through the links in `.agents/skills/`: a new rule gets a line in `AGENTS.md`, a new skill a link there.
