---
name: deployment
description: Package and run the system - the Dockerfile of a service, the gateway or the client, Docker Compose for development and for the whole system, the Kubernetes manifests (Deployment, StatefulSet, Service, ConfigMap, Secret, Ingress, probes, resources) and the one-command installation of QA-08. Use it for any task on images, Compose, Kubernetes or kind.
---

# Deployment

The target is in *Deployment* (`docs/devops.md`, with its picture) and in *State and scaling* (`docs/_includes/microservices.md`): one container per service; the stateless services as Deployments; Editing, Kafka and every database as StatefulSets, each with its own volume; one PostgreSQL server per service (ADR-06); a single node.

## Images

- One image per deployable (each service, the gateway, the client), and one process per container.
- Build from the root of the repository: a Go service needs the chassis module through `go.work`, and Editing needs the CRDT package through the npm workspaces.
- Order the Dockerfile for the cache: first the dependency manifests (`go.work`, `go.mod` and `go.sum`; `package.json` and `package-lock.json`), then the download, then the sources. A `.dockerignore` keeps out `node_modules`, build outputs and anything secret.
- Ship only what runs: the Go binary built in one stage and copied into a minimal runtime image; Editing on the official Node.js image, for the native binding of Kafka (ADR-07); the client as static files.
- Run as a user other than root.
- Nothing that depends on the environment goes inside: configuration and secrets arrive as environment variables at run time.
- Tag with something immutable, the commit or the release version; `latest` alone doesn't say what is running.

## Docker Compose

- A container reaches another by its service name.
- Every stateful container has a healthcheck that is cheap and changes nothing (`pg_isready`, a metadata request to Kafka), and a service waits for its dependencies with `depends_on` and `condition: service_healthy`.
- Data lives in named volumes: `docker compose down` keeps them, `down -v` deletes them.
- Each service runs its migrations at start (ADR-06), so no manual database step is ever needed (QA-08).

## Kubernetes

- Declarative manifests, versioned in the repository; no change by hand with `kubectl`.
- Each stateless service is a Deployment behind a ClusterIP Service, and a caller uses the DNS name of the Service.
- Editing is a StatefulSet behind a headless Service, so that the gateway reaches each instance by its stable name; don't change its number of replicas outside the procedure in *State and scaling*. Kafka and each PostgreSQL are StatefulSets with a volume claim.
- Liveness probe on `/health/live`, readiness probe on `/health/ready`, with a startup allowance for the replay of Editing (`observability` skill).
- Configuration from a ConfigMap, credentials and keys from a Secret, both as environment variables.
- Requests and limits of CPU and memory on every container, so the scheduler can place each pod and none starves the node.
- The Ingress leads only to the client and the gateway: the services trust `X-User-Id`, which only the gateway sets (ADR-09). It serves HTTPS, since the cookie of ADR-09 is `Secure`.

## Check it

- Every container reaches ready, in Compose and on kind (`kubectl wait --for=condition=Ready pods --all`).
- No service answers from outside the cluster except through the gateway.
- QA-08: on a clean host, one documented command brings up a reachable instance within the response measure of the scenario.
