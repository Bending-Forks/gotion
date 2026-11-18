---
name: ci-cd
description: Change the GitHub Actions workflows - add or change a job of the CI, run jobs only for what a pull request changes, test matrices, caching, the check of generated code, building and publishing images from main, releases. Use it for any task on `.github/workflows/`.
---

# CI/CD

How the pipeline works and why is in *CI/CD* (`docs/devops.md`); the ruleset and the merge flow are in the Git workflow of `CLAUDE.md`. Update that section in the same PR as the workflow.

## Rules of the pipeline

- **`success` collects every job.** A new job goes into its `needs`. It must always report, so a workflow is never filtered with `paths:` on its trigger: skip inside it, with a `changes` job and an `if:` on each job (the plan is in the comment under *CI/CD*). Renaming `success` breaks the ruleset of `main`.
- **Pull requests verify, `main` delivers.** Checks run on `pull_request`. `main` only takes a fast-forward of a branch that is already green, so it doesn't run them again. Whatever publishes (the report, images, releases) runs on a push to `main`, after `success`, and nowhere else: a pull request never sees the secrets.
- **A pull request rehearses the delivery.** It builds what it changes (an image, the site) without publishing, so a broken Dockerfile fails before the merge.
- **Every run starts from a clean runner.** The workflow installs everything it needs, with the versions the repository declares (`go.work`, the lockfiles), and uses `npm ci`.
- **Caching** goes through the setup actions (`cache: npm`, `cache-dependency-path` for Go), never by hand.
- **Matrices** over operating systems and runtime versions only where the result can differ, as for the services (ADR-04). Use `fail-fast: false` while finding out whether a failure depends on the platform, and `shell: bash` on steps that must run on Windows.
- **Least privilege.** `permissions: contents: read` at the top of the workflow, widened only in the job that needs it (`pages: write`, `packages: write`).
- **Repeated steps** become a composite action in `.github/actions/<name>/action.yml`; repeated jobs become a reusable workflow.
- **No `schedule:` trigger in `ci.yml`.** In a public repository GitHub disables a workflow with a scheduled trigger after 60 days without activity, and a disabled workflow runs on no event at all: the CI would stop.
- An `if:` that mixes events (`push` and `pull_request`) must be read for both, as the condition of `deploy` shows.
