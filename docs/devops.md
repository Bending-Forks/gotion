---
title: DevOps
icon: 🚀
nav_order: 5
---

## Project Structure

Gotion lives in one Git repository. Every service, the web client and every shared library is a package of its own, a Go module or an npm workspace, with its own `.claude/` folder for the instructions of Claude Code that apply only to that package; the rules every hexagon shares are written once, in the `.claude/` folder of the root. In the root, `go.work` joins the Go modules into one workspace, and the `workspaces` of `package.json` do the same for the npm packages.

![Packages of the Gotion monorepo]({{ '/assets/devops/monorepo.svg' | relative_url }})

Inside each service, `internal/` (`src/` in Editing) holds the hexagon of [Hexagonal Architecture](design.html#hexagonal-architecture):

- `domain/` holds the aggregates, value objects and rules of the bounded context. It imports only the standard library, and in Editing the CRDT of `packages/crdt`, which is the model of the document.
- `app/` holds one application service per command, query or policy, and declares the ports as interfaces: a repository, the outbox, the query to another service.
- `adapters/` implements the ports and calls the application services: the REST server, the Kafka consumers, the repositories on PostgreSQL, the clients of other services. The code generated from the specifications in `api/` and from SQL lives in the adapter that uses it. A consumer generates the types of an event from the `api/` of its producer, so no package of shared types exists.

`api/` holds the OpenAPI and AsyncAPI specifications of the service, `api/events/` the JSON Schema of the body of each of its events, and `api/contracts/<consumer>/` the examples each consumer writes of what it reads from them, one folder per relation of the context map ([Contract tests](implementation.html#contract-tests)). The envelope shared by every event is in the `api/` folder at the root of the repository ([Contracts](design.html#contracts)).

`main.go` (`src/main.ts` in Editing) reads the configuration, builds the adapters and connects them to the ports. `migrations/` holds the SQL migrations of the service's database, run at start ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)). The gateway has no domain and no database: `proxy/` forwards the client's requests to the services and the WebSocket of each page to its Editing instance, and `directory/` composes the Workspace directory ([API Composition](design.html#api-composition)).

The chassis has one package per concern: the HTTP server, the health checks, the metrics, the configuration, the logs, the PostgreSQL pool with its migrations, the Kafka consumers, the outbox, the client of the queries and the sign-in token ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries), [ADR-09](design.html#adr-09-the-sign-in-token-is-a-jwt-signed-with-ed25519-in-an-httponly-cookie)). A service imports only the ones it needs: the gateway imports neither `postgres/` nor `outbox/`, and only Account and the gateway import `token/`.

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

A pull request is merged with `scripts/ff-merge.sh`: it rebases the branch on `main`, checks that the CI passed and the PR is approved, so it stops before the server would refuse, then pushes the head of the branch straight onto `main`. The server accepts only a fast-forward, so the commits keep their signatures and the history stays linear. Then it moves onto `main` the open pull requests that had the merged branch as their base, because GitHub closes a pull request whose base branch is deleted. For the same reason the `pre-push` hook refuses to delete a remote branch that an open pull request comes from or goes into. Renovate pull requests are squashed instead, by Renovate itself (see [CI/CD](#cicd)). Locally, each of us pulls with `pull.rebase = true`.

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

- `test`, on pull requests only, runs the Node tests of the report on Linux with Node 24: they cover a script that runs in the reader's browser, so other systems or Node versions would tell us nothing more;
- `go`, on pull requests only, runs `go vet`, `go build` and `go test` on every module of the Go workspace, with the oldest Go the modules accept, the one `go.work` declares;
- `node`, on pull requests only, checks the types of Editing and of the CRDT package with `tsc` and runs their tests on Node 24;
- `site` builds the report with Jekyll, failing on invalid front matter;
- `commits`, on pull requests only, checks the title of every commit against Conventional Commits, so skipping the local hook does not help;
- `success` collects the result of the jobs above.

A push to `main` does not repeat the jobs that run on pull requests only: the ruleset lets in only a branch that is up to date with `main` and green, so what reaches `main` has the same content the pull request already checked. A new push to a pull request cancels the runs still going on its older commits; runs on `main` are never cancelled.

<!-- TODO first service: add a `changes` job that lists the files changed by the pull request (`git diff --name-only` between base and head), and run each job only for its own part: `site` for `docs/`, and for every service a test matrix over the operating systems and the versions of its runtime (Go, Node.js, see ADR-04), only when its folder changes. A change in the `api/` of a service also runs the tests of its consumers, and a change in `services/X/api/contracts/Y/` runs the tests of both X, the provider, and Y, the consumer (see Contract tests in Implementation). Do not filter with `paths:` on the trigger: `success` must always report, or the ruleset blocks the pull request. -->

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

The tasks of the project live in a Notion database, the Tasks Tracker, and a second workflow, `notion.yml`, keeps it in step with the pull requests through a third database, Pull Requests, with one page per pull request. On every change to a pull request (opened, description edited, reopened, closed, marked draft or ready for review) the workflow writes its title, the type of change taken from the Conventional Commits title, state (draft, open, merged or closed), author, branch, opening and merge dates into the page, which works out the lead time from opening to merge, and relates it to the tasks of the tracker that the description links to, from which the page takes their Targets. A task can thus have several pull requests, and the tracker shows their state. When a pull request reaches `main`, the workflow moves each of its tasks to Done once none of the task's pull requests is still open. It recognises the merge both from the `closed` event and from the push onto `main`, where it looks for the pull request whose head is the pushed commit, which is how `scripts/ff-merge.sh` merges. The logic is in `.github/scripts/notion.mjs`, whose pure parts are tested with the other Node tests. It calls the Notion API with the token of a Notion integration, kept as a repository secret, and does nothing without it. It stays out of the CI on purpose: it checks nothing, so a Notion outage must not turn `success` red.

<!-- TODO SLO: the development time scenarios become gates in the pipeline: QA-08 (a
fresh-install job on a clean runner: one documented command, reachable within 600 s, no
manual database step), QA-09 (an architecture test: real-time synchronization and
persistence do not depend on any block type), QA-10 (axe-core with 0 WCAG 2.1 AA violations,
and a keyboard-only e2e test for every block operation). -->

## Deployment

Gotion runs on Kubernetes, on a single node (kind or Minikube). Every stateless service is a Deployment; Editing, Kafka and every database are StatefulSets, each with its own volume.

![Deployment of Gotion on Kubernetes]({{ '/assets/devops/deployment.svg' | relative_url }})

<!-- TODO SLO: Gotion is self-hosted, so the running instance is the customer's: the
monitoring stack (Prometheus, and Grafana with the SLO dashboards and alerts) is part of the
deployment, started by the same documented command of QA-08. -->

## Benchmark

<!-- TODO SLO: before a release, run the runtime scenarios as tests on the reference
deployment (4 vCPU, 8 GB RAM, 50 members, 10 000 pages, 1 000 000 blocks, a placeholder: see
the TODO in Quality Attributes): QA-01, QA-02 with
5 concurrent editors, QA-03 with a cold cache, QA-04 recovery after a crash. The benchmark
checks each scenario in one run; Monitoring checks the SLO over time on a running instance. -->
