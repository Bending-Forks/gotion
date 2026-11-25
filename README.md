# gotion

🗒️ Self hosted Notion clone.

The report is published at <https://bending-forks.github.io/gotion/>.

## Run the report locally

The report is a plain [Jekyll](https://jekyllrb.com/) site with no Gemfile and no plugins, so only Ruby and the `jekyll` gem are needed:

```sh
gem install jekyll
jekyll serve --source docs --livereload
```

Then open <http://127.0.0.1:4000/gotion/>. The `/gotion` path comes from `baseurl` in `docs/_config.yml`, the same path GitHub Pages serves it under.

## Build and test

The services need Go 1.25 or later and Node.js 24 or later. From the root of the repository:

```sh
npm install
go vet $(go list -m -f '{{.Dir}}/...')
go build $(go list -m -f '{{.Dir}}/...')
go test $(go list -m -f '{{.Dir}}/...')
npm run build -w services/editing -w packages/crdt
npm test -w services/editing -w packages/crdt
```

`go.work` joins the Go modules into one workspace, but `./...` from the root does not reach into them, hence the list of modules; for a single one, use its path, as in `go test ./services/account/...`. Editing and the CRDT package run their TypeScript sources directly on Node.js, so `npm run build` only checks their types.

## Development environment

`compose.yaml` starts what the services run against during development and in the integration tests: Kafka in KRaft mode, with a topic for each upstream context (`account`, `membership`, `editing`, `discussion`), and one PostgreSQL server per service. The services themselves are not in it yet. From the root of the repository, with Docker Compose:

```sh
docker compose up -d
docker compose wait kafka-topics  # returns once the topics exist
```

| | From the host | From a container of the Compose |
| --- | --- | --- |
| Kafka | `localhost:9094` | `kafka:9092` |
| Account | `postgres://account:account@localhost:5433/account` | `account-db:5432` |
| Membership | `postgres://membership:membership@localhost:5434/membership` | `membership-db:5432` |
| Editing | `postgres://editing:editing@localhost:5435/editing` | `editing-db:5432` |
| Discussion | `postgres://discussion:discussion@localhost:5436/discussion` | `discussion-db:5432` |
| Notification | `postgres://notification:notification@localhost:5437/notification` | `notification-db:5432` |

Each user owns its server, so an integration test can create and drop its own databases there: the one of Editing takes its server from `TEST_DATABASE_URL`, as in `TEST_DATABASE_URL=postgres://editing:editing@localhost:5435/editing npm test -w services/editing`, and is skipped without it. The ports listen only on 127.0.0.1 and each password equals the user name, so use this setup only on a development machine. `docker compose down` stops the containers and keeps the data in named volumes; `docker compose down -v` deletes the data too. The project is named `gotion`, so every checkout and worktree shares one instance: start it from any of them, and keep in mind that `down -v` empties it for all. To run a second instance beside it, give that one a name and a port prefix of its own: `COMPOSE_PROJECT_NAME=gotion-<task> GOTION_PORT_PREFIX=1 docker compose up -d` puts a 1 in front of every port on the host (15433, 19094), and the same variables stop it.

On rootless Podman, a Compose that goes through the Podman socket does not work yet: its containers inherit `oom_score_adj` 200 from `podman.service`, every `exec` into them fails, healthchecks included, and Kafka never becomes healthy.

## Kubernetes

`deploy/kubernetes/` holds the Kubernetes manifests, built with Kustomize, which is part of `kubectl`. So far they run Kafka with its topics and the five PostgreSQL servers, each as a StatefulSet with its own volume, in the namespace `gotion` of a single-node cluster such as [kind](https://kind.sigs.k8s.io/). From the root of the repository, with `kubectl` pointing at the cluster:

```sh
deploy/kubernetes/secrets.sh
kubectl delete job kafka-topics --namespace gotion --ignore-not-found
kubectl apply -k deploy/kubernetes
kubectl wait --namespace gotion --for=condition=Complete job/kafka-topics --timeout=300s  # returns once the topics exist
```

The same commands update an installation. They delete the Job `kafka-topics` first because Kubernetes refuses any change to the pod template of an existing Job, so an update that brings a new Kafka image would fail on the old one. The new Job finds the topics already there and leaves them as they are (`--if-not-exists`).

`secrets.sh` creates the Secret of each database, `<service>-db`, with the name of the service as user and database and a random password, and keeps a Secret that already exists, since a server takes its password only on its first start. No credential is in the repository: `kubectl get secret account-db --namespace gotion -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d` prints one. Inside the cluster Kafka is at `kafka:9092` and each server at `<service>-db:5432`, the same names as in Compose, and nothing is reachable from outside it. A pod that is deleted or crashes comes back with its data, which stays on the volume of its StatefulSet; `kubectl delete namespace gotion` deletes the data too.

## Contributing

Run `npm install` once after cloning: it installs the dependencies of the npm workspaces and the git hooks (through [husky](https://typicode.github.io/husky/)) that check every commit title against [Conventional Commits](https://www.conventionalcommits.org/) and refuse to delete a remote branch with open pull requests into or out of it.

With Claude Code, the project settings (`.claude/settings.json`) turn on two plugins. Install Superpowers once for your user and disable it there, so that it runs in every checkout and worktree of Gotion and nowhere else:

```sh
claude plugin install superpowers@claude-plugins-official
claude plugin disable superpowers@claude-plugins-official --scope user
```

An install with `--scope project` is bound to the path of one folder, so it stops working when the worktree moves and never reaches the others. The `humanizer` plugin comes from its own marketplace: Claude Code offers to install it when you trust the folder, or install it for your user with `claude plugin marketplace add blader/humanizer && claude plugin install humanizer@humanizer`.
