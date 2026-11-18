# Go chassis

- Check and test from the root of the repository: `go vet ./packages/chassis/... && go test ./packages/chassis/...`.
- One package per concern (`server`, `health`, `metrics`, `config`, `logging`, `postgres`, `consumer`, `outbox`, `queryclient`, `token`); a service imports only the ones it needs, and each package has its own tests.
- It never imports a service and holds no rule of any bounded context.
- The library of each concern is listed in Implementation › Go services and API gateway (ADR-07); the standard library first, and no OpenTelemetry.
