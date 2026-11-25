# Go chassis

- Check and test from the root of the repository: `go vet ./packages/chassis/... && go test ./packages/chassis/...`.
- One package per concern (`server`, `health`, `metrics`, `config`, `logging`, `postgres`, `consumer`, `outbox`, `queryclient`, `token`); a service imports only the ones it needs, and each package has its own tests.
- It never imports a service and holds no rule of any bounded context.
- It is a thin chassis assembled from the libraries ADR-07 chose, one per concern, not a framework and not written from scratch: `server` on `net/http` (the handlers are the strict server `oapi-codegen` generates in each service), `health`, `config` and `logging` on the standard library (`os.Getenv`, `log/slog`), `metrics` on `prometheus/client_golang`, `postgres` on `jackc/pgx/v5` with `pressly/goose`, `consumer` on Watermill with `watermill-kafka`, `outbox` on `watermill-sql` and the Forwarder of Watermill, `queryclient` on `context` and `sony/gobreaker/v2`, `token` on `golang-jwt/jwt/v5` and `crypto/ed25519`. Each `doc.go` names its library.
- Only the glue is ours: the wiring of each library, the task that deletes the old rows of the outbox and the metrics of the pending ones, the deduplication on the identifier of the envelope. Don't hand-write what a chosen library covers, and don't replace one, without a new decision.
- Watermill's `Message` type stays inside the chassis and the adapters, never in a domain or an application service. No OpenTelemetry.
- A query to another service goes through a `queryclient.Client`, one per callee, passed to the client `oapi-codegen` generates with `WithHTTPClient`. The adapter turns any error of the call into a refused command (503), and maps each 4xx to its meaning in Contracts.

## State

`server`, `health`, `config`, `logging`, `metrics` (Prometheus HTTP metrics) and `queryclient` are implemented, with a runnable example in `cmd/example`. `postgres`, `consumer`, `outbox` and `token` hold just their `doc.go`.
