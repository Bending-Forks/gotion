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

`compose.yaml` starts what the services run against during development and in the integration tests: Kafka in KRaft mode, with a topic for each upstream context (`account`, `membership`, `editing`, `discussion`), and one PostgreSQL server per service. The services themselves are not in it yet. From the root of the repository, with Docker, or Podman with Compose:

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

Each user owns its server, so an integration test can create and drop its own databases there. The ports listen only on 127.0.0.1 and each password equals the user name, so use this setup only on a development machine. `docker compose down` stops the containers and keeps the data in named volumes; `docker compose down -v` deletes the data too.

## Contributing

Run `npm install` once after cloning: it installs the dependencies of the npm workspaces and the git hooks (through [husky](https://typicode.github.io/husky/)) that check every commit title against [Conventional Commits](https://www.conventionalcommits.org/) and refuse to delete a remote branch with open pull requests into or out of it.
