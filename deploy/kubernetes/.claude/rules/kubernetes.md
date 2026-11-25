# Kubernetes manifests

- Built with Kustomize, all in the namespace `gotion`; the commands that install and update them are in the README, the conventions of the manifests in the `deployment` skill.
- `kafka.yaml` has Kafka and the Job `kafka-topics` that creates its topics. Each PostgreSQL server is a `<service>-db/` instance of `postgres/`, a StatefulSet with its own volume.
- No credential is in the repository: `secrets.sh` creates the Secret `<service>-db` of each database with a random password and keeps one that exists.

## State

Kafka with its topics and the five PostgreSQL servers are implemented. The services, the gateway and the client are not in the manifests yet.
