---
name: fitness-function
description: Turn an architectural rule into an automated check that fails the pull request - a dependency rule of the hexagon or of a package, the Compliance of an ADR, a development-time quality attribute such as QA-09. Use it for lint rules on imports, architecture tests, and whenever a rule reads "X must not depend on Y" or "only X may import Y".
---

# Fitness functions

A fitness function is any mechanism that gives an objective verdict on an architectural characteristic: a lint rule, a test on the dependency graph, a metric with a threshold, a check on the running system. Here they run in the CI, so a violation fails the pull request instead of waiting for someone to notice it in a review.

## 1. State the rule

- Find where it comes from: the *Compliance* of an ADR (`docs/_includes/adr.md`), the rules of the hexagon (`.claude/rules/hexagon.md`) or of a package, a development-time scenario in `docs/_includes/quality-attributes.md`.
- Write it as one sentence a tool can check: "`domain/` and `app/` import no library of the chassis" (ADR-07), "the CRDT, the session log and the repositories of Editing import no subtype of `BlockContent`" (QA-09).

## 2. Pick the cheapest mechanism that gives a clear verdict

1. **A lint rule on imports**, when the rule says who may import what: the depguard rules of golangci-lint in Go, dependency-cruiser in TypeScript (ADR-07). One rule per forbidden dependency, scoped to the paths it governs.
2. **A test on the dependency graph**, when a linter can't express the rule (transitive dependencies, "depends on no event of"): in Go a `_test.go` that walks `go list -deps -json` of the packages concerned, in TypeScript a `node:test` that inspects their imports.
3. **A metric with a threshold, or a test on the running system**, for runtime characteristics: those belong to the `observability` and `test-strategy` skills, not to lint.

## 3. Make it trustworthy

- **Prove it fails.** Add one violation, such as a forbidden import in a scratch file, see the check fail and read its message, then remove the violation. A rule that never failed may be checking nothing.
- **Say why in the failure message**: the rule and its source, such as "ADR-07: domain/ imports no library".
- **Run it in the CI**, inside an existing job or in a new one listed in the `needs` of `success`, which the ruleset of `main` requires.
- **Close the loop**: name the check where the rule is stated, the *Compliance* of the ADR or the gate of the QA scenario in *CI/CD* (`docs/devops.md`), and describe a new tool under *Quality Assurance* in `docs/devops.md`.
