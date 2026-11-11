---
title: DevOps
icon: 🚀
nav_order: 5
---

## Project Structure

## VCS & Repo

Gotion follows trunk-based development: `main` is the only long-lived branch, for both the
code and this report. There is no develop branch and no release branch. Every change starts
on a short-lived branch, named after the Conventional Commits type of the change (`feat/…`,
`fix/…`, `docs/…`, `ci/…`), opened for a single pull request and deleted once it is merged.

Each branch can get its own working copy as a git worktree next to the repository. `scripts/new-worktree.sh <type>/<task>` creates `../gotion-<task>` on that branch, taking the existing one, local or on the remote, or else starting a new one from `origin/main`, and installs the npm dependencies, so the commit hooks work there too; it prints which of these cases it found. `scripts/remove-worktree.sh <type>/<task>` removes the worktree and deletes the branch locally and on the remote, asking first if the branch holds commits that are not in `main`. We found worktrees useful for running several Claude Code sessions in parallel, one per task: each session works in its own folder on its own branch, so none of them changes the files another one is editing.

The ruleset of `main` lets a change in only from an approved pull request with its review
threads resolved; every commit must be signed, the history must be linear, and force pushes
and deletion are blocked. Merge commits are disabled in the repository settings.

The ruleset also requires a green CI: the `success` check, emitted by GitHub Actions, must
have passed on a branch that is up to date with `main`. We require this single check, not
the individual jobs, because `success` is the job that collects all the others: adding a job
or changing the test matrix does not touch the ruleset, while a failed or cancelled job still
makes it fail. Tying the check to GitHub Actions means a status set by hand through the API
cannot stand in for it. So a red CI keeps a change out whatever way it comes in: the merge
script, a manual push, or the squash of a Renovate pull request.

A pull request is merged with `scripts/ff-merge.sh`: it rebases the branch on `main`, checks
that the CI passed and the PR is approved, so it stops before the server would refuse, then
pushes the head of the branch straight onto `main`. The server accepts only a fast-forward, so
the commits keep their signatures and the history stays linear. Renovate pull requests are
squashed instead, by Renovate itself (see [CI/CD](#cicd)). Locally, each of us pulls with
`pull.rebase = true`.

Until [#15](https://github.com/Bending-Forks/gotion/pull/15) the report lived on a separate
`gh-pages` branch, published by the legacy Pages build, while the repository tooling lived on
`main`. The two branches had diverged right after the initial commit. To join them we moved
`main` onto `gh-pages` with one force push, the only one in the history of the repository: the
ruleset was lifted on `main` for that push alone, `--force-with-lease` made sure no one had
pushed meanwhile, and both authors agreed on it beforehand. This kept the 48 commits of the
report with their SHAs and signatures; the four commits of the old `main` were replayed on top
in the same pull request. `gh-pages` is kept as the tag `archive/gh-pages`.

## Quality Assurance

## CI/CD

The CI runs on every pull request and on every push to `main`:

- `test`, on pull requests only, runs the Node tests on Linux with Node 24: they cover a
  script that runs in the reader's browser, so other systems or Node versions would tell us
  nothing more;
- `site` builds the report with Jekyll, failing on invalid front matter;
- `commits`, on pull requests only, checks the title of every commit against Conventional
  Commits, so skipping the local hook does not help;
- `success` collects the result of the jobs above.

A push to `main` does not repeat `test` and `commits`: the ruleset lets in only a branch that
is up to date with `main` and green, so what reaches `main` has the same content the pull
request already checked. A new push to a pull request cancels the runs still going on its
older commits; runs on `main` are never cancelled.

<!-- TODO first service: add a `changes` job that lists the files changed by the pull request
(`git diff --name-only` between base and head), and run each job only for its own part: `site`
for `docs/`, and for every service a test matrix over the operating systems and the versions
of its runtime (Go, Node.js, see ADR-04), only when its folder changes. Do not filter with
`paths:` on the trigger: `success` must always report, or the ruleset blocks the pull request. -->

On a push to `main`, and only if `success` passed, `deploy` publishes the report to GitHub
Pages. The deployment goes to the `github-pages` environment, which accepts only `main`, so a
pull request cannot publish anything.

Dependencies are kept up to date by Renovate, configured in `renovate.json`. It finds the
GitHub Actions of the workflow and the npm packages, and opens one pull request per update,
titled in Conventional Commits: `ci(deps): …` for the workflow, `chore(deps): …` for the
rest. An npm release is proposed only once it is three days old, so a version retracted soon
after publishing never reaches us, and once a week a pull request refreshes
`package-lock.json`, transitive dependencies included. A Renovate pull request goes through the
same CI and needs the same approval as any other; once it is approved and `success` is green,
Renovate squashes it onto `main` on its next run, and the push deploys the report. We left
GitHub auto-merge disabled: it would put an auto-merge button on every pull request, and with
squash as the only merge method allowed by the settings, that button would merge a human pull
request past the merge script.

<!-- TODO SLO: the development time scenarios become gates in the pipeline: QA-08 (a
fresh-install job on a clean runner: one documented command, reachable within 600 s, no
manual database step), QA-09 (an architecture test: real-time synchronization and
persistence do not depend on any block type), QA-10 (axe-core with 0 WCAG 2.1 AA violations,
and a keyboard-only e2e test for every block operation). -->

## Deployment

<!-- TODO SLO: Gotion is self-hosted, so the running instance is the customer's: the
monitoring stack (Prometheus, and Grafana with the SLO dashboards and alerts) is part of the
deployment, started by the same documented command of QA-08. -->

## Benchmark

<!-- TODO SLO: before a release, run the runtime scenarios as tests on the reference
deployment (4 vCPU, 8 GB RAM, 50 members, 10 000 pages, 1 000 000 blocks, a placeholder: see
the TODO in Quality Attributes): QA-01, QA-02 with
5 concurrent editors, QA-03 with a cold cache, QA-04 recovery after a crash. The benchmark
checks each scenario in one run; Monitoring checks the SLO over time on a running instance. -->
