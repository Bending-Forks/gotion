---
paths:
  - "**/*.go"
  - "**/go.mod"
  - ".golangci.yml"
---

# Go

These rules apply to every Go module: the services, the gateway and the chassis. Where the skills `golang-concurrency` and `golang-safety` (copied from samber/cc-skills-golang) say otherwise, these rules win. Ignore their references to skills of that collection that are not in `.claude/skills/`, and use their audit modes, which fan out sub-agents, only when the user asks.

## Language and dependencies

- One module per service and one for the chassis, module path `github.com/Bending-Forks/gotion/<path>`, joined by `go.work`. From the root `./...` does not reach into the modules of the workspace: use `$(go list -m -f '{{.Dir}}/...')`, or the path of one module (`go test ./services/account/...`).
- The `go` directive, `go 1.25.0`, is the oldest Go we support: use what it offers (`slices`, `maps`, `cmp`, `min` and `max`, range over integers and over iterators, `errors.Join`, `sync.OnceValue`, `sync.WaitGroup.Go`, `t.Context()`, `testing/synctest`) and nothing newer. Raising it is a decision, not a cleanup; Renovate proposes no release of a module that needs a newer Go (`constraintsFiltering` in `renovate.json`).
- The standard library first, then the libraries ADR-07 chose. Any other dependency, test-only ones included (`go.uber.org/goleak`, `golang.org/x/sync`), needs a reason in the PR; replacing a chosen one needs a decision.
- A code generator is a tool of the module that runs it, added with `go get -tool`, so `go.mod` pins its version and Renovate updates it. The `//go:generate` line sits next to the adapter that uses the generated code; the output is committed and never edited by hand.
- Before a commit, `gofmt -l`, `go vet` and `go test -race` pass on the module you changed (its path is in the rule of the package). The CI also runs golangci-lint with `.golangci.yml`, whose depguard rule lets `domain/` and `app/` import only `domain/` and the standard library, minus `net/http`, `net/http/httputil`, `log/slog` and `os`, which ADR-07 gives to the chassis: a new service with a hexagon adds its `internal/domain` to the allow list of the rule. A deny entry covers only its exact package, so each needs its own. The violations of the rule are in `tests/fixtures/fitness/go/`, a module outside `go.work`, at the paths they would have in the repository, one per file, and the job fails unless the rule reports every Go file there.

## Errors

- A refusal of the domain is an exported error of `domain/`, named in the terms of the glossary (`ErrWorkspaceDeleted`), or an error type when it carries data. The application service returns it unchanged; only the adapter turns it into an HTTP status.
- Wrap an error with what was being done: `fmt.Errorf("load workspace %s: %w", id, err)`. Match it with `errors.Is` or `errors.As`, never by comparing strings.
- An error is handled or returned, never both: no log followed by a return. It is logged once, at the edge.
- A function that returns `error` returns a literal `nil` on success, never a typed nil pointer.
- `panic` only for a programming error at start, never for a failure that can happen.

## Context

- `ctx context.Context` is the first parameter of every port and of every application service that does I/O, and is never stored in a struct. The domain takes none.
- The context comes from the request or the message being handled: `context.Background()` only in `main`, and `t.Context()` in tests.

## Types of the model

- Each identity has a type of its own (`WorkspaceID`, `UserID`), so two cannot be swapped.
- A value object has unexported fields, a constructor `NewX(...) (X, error)` that refuses an invalid value, value receivers, and compares with `==`.
- A root has unexported fields, pointer receivers, one method per command and no setters. A getter of a slice or a map returns a copy, or a caller could break an invariant.
- No JSON or SQL tags in `domain/`: the adapter maps between its generated types and the domain.

## Interfaces

- An interface is declared by the package that uses it (`app/` declares its ports), small, named after its role, with no `I` prefix or `Impl` suffix. Constructors return concrete types.
- Each adapter checks at compile time that it implements its port: `var _ app.WorkspaceRepository = (*WorkspaceStore)(nil)`.

## Goroutines

- Every goroutine has an owner that waits for it and stops it through the context; a background loop selects on `ctx.Done()`.
- State shared between goroutines sits behind a mutex or belongs to one goroutine.

## Tests

- The standard `testing` package and hand-written fakes that implement the ports: no assertion or mocking framework.
- Table-driven tests with `t.Run`, each case named after the rule it checks; `t.Parallel()` where tests share nothing; `t.Helper()` in helpers.
- The tests of `domain/` and `app/` are in the `_test` package and use only the exported API.
- Logic that depends on time or goroutines is tested inside `testing/synctest`, with its fake clock, not with `time.Sleep`. A test against real infrastructure polls for the expected state, with a deadline.

## Logs and configuration

- `main` builds the `*slog.Logger` with the chassis and passes it to the adapters. The domain and the application services don't log: they return errors and events.
- `os.Getenv` only in the `config` package of the chassis, read once in `main`.

## Database

- The migrations of a service are goose SQL files in `migrations/`, numbered `00001_<name>.sql`, each with `-- +goose Up` and, when it can be undone, `-- +goose Down`. `migrations/migrations.go` embeds them (`//go:embed *.sql` into `var FS embed.FS`), and `main` passes `migrations.FS` to `postgres.Open` of the chassis with `config.DatabaseURL()`, before it starts listening; the readiness check of the database is `pool.Ping`.
- A service that consumes events puts `consumer.Schema` of the chassis in one of its migrations, as it is, and `main` runs `consumer.NewRouter(...).Run` beside the server, with the brokers of `config.KafkaBrokers()`.
- The access to the data is generated by sqlc, a tool of the service's module: `go get -tool github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0`, the last release that runs on our `go` directive (v1.31 needs Go 1.26). Its first build compiles the PostgreSQL parser with cgo and takes a few minutes.
- `internal/adapters/postgres/` holds the queries (`queries.sql`, with `-- name:` annotations), `sqlc.yaml`, the code sqlc generates into the same package, and the repositories. `sqlc.yaml` has `engine: postgresql`, `schema: ../../../migrations` (sqlc reads the goose files and skips their Down part), `queries: queries.sql` and `gen.go` with `package: postgres`, `out: .` and `sql_package: pgx/v5`; `//go:generate go tool sqlc generate` sits in a file of that package.
- The generated `Queries` takes a `DBTX`, which `*pgxpool.Pool` and `pgx.Tx` both satisfy: a repository runs a query inside the transaction it shares with the outbox through `WithTx` (ADR-05). The repository maps the generated rows to the domain; no generated type leaves the adapter.
