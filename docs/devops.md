---
title: DevOps
icon: 🚀
nav_order: 5
---

## Project Structure

Gotion lives in one Git repository. Every service, the web client and every shared library is a package of its own, a Go module or an npm workspace, with its own `.claude/` folder for the instructions of Claude Code that apply only to that package; the rules every hexagon shares are written once, in the `.claude/` folder of the root. In the root, `go.work` joins the Go modules into one workspace, and the `workspaces` of `package.json` do the same for the npm packages.

![Packages of the Gotion monorepo]({{ '/assets/devops/monorepo.svg' | relative_url }})

Inside each service, `internal/` (`src/` in Editing) holds the hexagon of [Hexagonal Architecture](design.html#hexagonal-architecture):

- `domain/` holds the aggregates, value objects and rules of the bounded context. In the Go services it imports only the standard library; in Editing it imports only the CRDT of `packages/crdt`, which is the model of the document and imports nothing outside itself, and no `node:` module.
- `app/` holds one application service per command, query or policy, and declares the ports as interfaces: a repository, the outbox, the query to another service. It imports only `domain/`, with no library and, in Editing, no `node:` module: there the domain alone sees the CRDT, and re-exports the types of the CRDT that the application services name.
- `adapters/` implements the ports and calls the application services: the REST server, the Kafka consumers, the repositories on PostgreSQL, the clients of other services. The code generated from the specifications in `api/` and from SQL lives in the adapter that uses it. A consumer generates the types of an event from the `api/` of its producer, so no package of shared types exists.

`api/` holds the OpenAPI and AsyncAPI specifications of the service, `api/events/` the JSON Schema of the body of each of its events, and `api/contracts/<consumer>/` the examples each consumer writes of what it reads from them, one folder per relation of the context map ([Contract tests](implementation.html#contract-tests)). The envelope shared by every event is in the `api/` folder at the root of the repository ([Contracts](design.html#contracts)).

`main.go` (`src/main.ts` in Editing) reads the configuration, builds the adapters and connects them to the ports. `migrations/` holds the SQL migrations of the service's database, run at start ([ADR-06](design.html#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own)). The gateway has no domain and no database: `proxy/` forwards the client's requests to the services and the WebSocket of each page to its Editing instance, and `directory/` composes the Workspace directory ([API Composition](design.html#api-composition)).

The chassis has one package per concern: the HTTP server, the health checks, the metrics, the configuration, the logs, the PostgreSQL pool with its migrations, the envelope of the events with the Kafka publisher, the Kafka consumers, the outbox, the client of the queries and the sign-in token ([ADR-07](design.html#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries), [ADR-09](design.html#adr-09-the-sign-in-token-is-a-jwt-signed-with-ed25519-in-an-httponly-cookie)). A service imports only the ones it needs: the gateway imports neither `postgres/` nor `outbox/`, and only Account and the gateway import `token/`.

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
- `go`, on pull requests only, runs `go vet`, `go build` and `go test` on every module of the Go workspace, with the oldest Go the modules accept, the one `go.work` declares. The integration tests of the chassis run against the `account-db` server and the Kafka of `compose.yaml`, where they create and drop their own databases and topics. They check that an instance does not migrate while another one holds the migration lock, and migrates once it is released (ADR-06); that each event reaches Kafka keyed by its aggregate; that a consumer applies a repeated event once; and the faults of the outbox that ADR-05 lists: a Kafka that does not answer across a restart of the service, a duplicate after an acknowledgement not yet marked, the order within an aggregate under concurrent commands and competing publishers, and the takeover by another replica. Kafka is shared with development, so a test makes it unreachable for the Forwarder by giving it an address where no broker listens, and never stops it. Then it runs golangci-lint with `.golangci.yml`: the standard linters, plus a depguard rule that lets the domain and the application services of the Go services import only their own domain and the standard library, except `net/http`, `net/http/httputil`, `log/slog` and `os`, which ADR-07 gives to the chassis for the HTTP server, the proxy of the gateway, the logs and the configuration. So neither the chassis nor any other library reaches them (ADR-07). It also lints `tests/fixtures/fitness/go/`, a module outside the workspace whose `domain/` and `app/` import the chassis and each of those packages, and fails unless the rule reports every one of its files, so a rule that stops matching the paths it governs also fails the pull request. One of the tests fails if the code of Discussion names an event of Membership, by the file of its schema or by its type, since Discussion only queries Membership and consumes none of its events (ADR-03);
- `node`, on pull requests only, checks the types of Editing, of the CRDT package and of the web client with `tsc`, builds the web client with Vite and runs the tests of all three on Node 24, one of them with the web client against a fake gateway, and those of Editing against the `editing-db` server of `compose.yaml`, the same they use in development, where they create and drop their own databases; then it fails if the bundle of the web client loads anything from another domain (BR-01);
- `lint`, on pull requests only, runs ESLint on the TypeScript of Editing, of the CRDT package and of the web client, with the recommended rules of ESLint and typescript-eslint, plus those of the React hooks in the client. Then dependency-cruiser checks the fitness functions on their imports: only the adapter of the client, in `client/web/src/editor/`, imports BlockNote, Tiptap or ProseMirror (ADR-01); the client and Editing import the CRDT by its package name, `@gotion/crdt`, and a relative path into `packages/crdt/` fails, as does Yjs, Automerge or the Yjs collaboration of BlockNote in the client, Editing or the CRDT (ADR-01, ADR-04); the domain and the application services of Editing import no library (ADR-07) and no `node:` module, as the hexagon above requires, and neither does the library code of the CRDT package, so the domain of Editing that imports it stays free of them too; and in Editing only the Kafka consumer of the events of Membership, in `src/adapters/membership-events/`, imports their types (ADR-03): its anticorruption layer turns them into calls to the application services that keep the copy of the roles, which the adapter of `AccessLookupService` reads, and make a removed member leave the sessions. A test in the `test` job runs each rule on a violation of it in `tests/fixtures/fitness/ts/`, so a rule that no longer matches the paths it governs also fails the pull request. Last, the job fails if `npm find-dupes` lists versions in `package-lock.json` that `npm dedupe` would merge, so a new dependency reuses the packages already installed wherever their versions allow it;
- `compose`, on pull requests only, starts `compose.yaml`, the Kafka and PostgreSQL servers we develop and run the integration tests against, with the command of the README; it fails if a topic is not created or a container never becomes healthy, so a broken file shows up before any service depends on it;
- `kubernetes`, on pull requests only, creates an empty kind cluster and starts on it the manifests of `deploy/kubernetes/` with the commands of the README: Kafka, the Job that creates its topics, and the five PostgreSQL servers. It waits for the topics and for every pod, then writes a message to Kafka and a row to the database of Account with the credentials of its Secret, deletes both pods and reads the message and the row back from the pods that replace them, so it fails if a volume does not outlive its pod. Then it runs the same commands again, as for an update, and fails if that changes a password, which would lock a service out of a server that already holds its data, or if the Job of the topics, deleted and created again, does not complete;
- `site` builds the report with Jekyll, failing on invalid front matter;
- `commits`, on pull requests only, checks the title of every commit against Conventional Commits, so skipping the local hook does not help;
- `success` collects the result of the jobs above.

A push to `main` does not repeat the jobs that run on pull requests only: the ruleset lets in only a branch that is up to date with `main` and green, so what reaches `main` has the same content the pull request already checked. A new push to a pull request cancels the runs still going on its older commits; runs on `main` are never cancelled.

<!-- TODO first service: add a `changes` job that lists the files changed by the pull request (`git diff --name-only` between base and head), and run each job only for its own part: `site` for `docs/`, and for every service a test matrix over the operating systems and the versions of its runtime (Go, Node.js, see ADR-04), only when its folder changes. A change in the `api/` of a service also runs the tests of its consumers, and a change in `services/X/api/contracts/Y/` runs the tests of both X, the provider, and Y, the consumer (see Contract tests in Implementation). Do not filter with `paths:` on the trigger: `success` must always report, or the ruleset blocks the pull request. -->

On a push to `main`, and only if `success` passed, `deploy` publishes the report to GitHub
Pages. The deployment goes to the `github-pages` environment, which accepts only `main`, so a
pull request cannot publish anything.

Dependencies are kept up to date by Renovate, configured in `renovate.json`. It finds the GitHub Actions of the workflows, the Go modules, the npm packages, Node.js and the container images in `compose.yaml` and in the manifests under `deploy/kubernetes/`, and works on Monday morning (Italian time), so the updates arrive in a weekly batch rather than one pull request at a time. All the minor and patch updates of the week go into a single pull request, `chore(deps): update all non-major dependencies`, and a second one refreshes `package-lock.json`, transitive dependencies included: two approvals a week instead of one per package. After each change to `package-lock.json` Renovate runs `npm dedupe`, so its pull requests pass the check of the `lint` job on duplicates. A major update can break the code, so it gets its own pull request, `ci(deps): …` for the workflows and `chore(deps): …` for the rest, and only once one of us ticks it in the Dependency Dashboard, the issue where Renovate lists what it has found; Node.js and `@types/node` stay on 24, since the Kafka client of Editing has prebuilt binaries only up to it. A PostgreSQL major can change the on-disk format, so moving the existing data to the new version requires `pg_upgrade` or a dump and restore. Renovate also leaves out the releases that would not run on our runtimes: a Go module whose new version needs a newer Go than the `go` directive of our `go.mod` files, 1.25, and an npm package whose `engines` do not cover Node.js 24. Raising either runtime is a decision we take ourselves, and an update must not take it for us. An npm release is proposed only once it is three days old, so a version retracted soon after publishing never reaches us. A Renovate pull request goes through the same CI and needs the same approval as any other; once it is approved and `success` is green, Renovate squashes it onto `main` on its next run, and the push deploys the report. We left GitHub auto-merge disabled: it would put an auto-merge button on every pull request, and with squash as the only merge method allowed by the settings, that button would merge a human pull request past the merge script.

GitHub watches the repository for security problems as well. Dependabot alerts report a dependency with a known vulnerability, and Renovate answers each one at once with a pull request of its own, marked `[SECURITY]` in its title, without waiting for Monday or for the three days of an npm release; Dependabot itself opens no pull requests, so the two tools never propose the same update twice. CodeQL, in GitHub's default setup, analyses the Go code, the TypeScript and JavaScript and the workflows on every pull request to `main`, on every push to it and once a week, and reports what it finds on the pull request and in the Security tab of the repository; it runs outside our workflow, so `success` does not wait for it and a finding does not block a merge. Secret scanning looks for tokens and keys committed by mistake, and its push protection refuses a push that contains one, before it enters a history we could not clean.

The tasks of the project live in a Notion database, the Tasks Tracker, and a second workflow, `notion.yml`, keeps it in step with the pull requests through a third database, Pull Requests, with one page per pull request. On every change to a pull request (opened, description edited, commits pushed, labels changed, reopened, closed, marked draft or ready for review) the workflow first labels it by the parts of the repository it changes, one label per service and package plus the contracts, the report, the CI, the infrastructure and the dependency updates of Renovate, as `.github/labeler.yml` maps them, and removes the labels that no longer match. Then it writes into the page its title, the type of change taken from the Conventional Commits title, its labels, those added by hand included, its state (draft, open, merged or closed), author, branch, opening and merge dates, which works out the lead time from opening to merge, and relates it to the tasks of the tracker that the description links to, from which the page takes their Targets. A task can thus have several pull requests, and the tracker shows their state. When a pull request reaches `main`, the workflow moves each of its tasks to Done once none of the task's pull requests is still open. It recognises the merge both from the `closed` event and from the push onto `main`, where it looks for the pull request whose head is the pushed commit, which is how `scripts/ff-merge.sh` merges. The logic is in `.github/scripts/notion.mjs`, whose pure parts are tested with the other Node tests. It calls the Notion API with the token of a Notion integration, kept as a repository secret, and does nothing without it. The labels are applied in this workflow rather than in one of their own because a label added with the token of a workflow starts no other workflow, so the page would never learn of it. It stays out of the CI on purpose: it checks nothing, so a Notion outage must not turn `success` red.

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
