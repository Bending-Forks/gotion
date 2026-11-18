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
modules=$(go list -m -f '{{.Dir}}/...')
go vet $modules && go build $modules && go test $modules
npm run build -w services/editing -w packages/crdt
npm test -w services/editing -w packages/crdt
```

`go.work` joins the Go modules into one workspace, but `./...` from the root does not reach into them, hence the list of modules; for a single one, use its path, as in `go test ./services/account/...`. Editing and the CRDT package run their TypeScript sources directly on Node.js, so `npm run build` only checks their types.

## Contributing

Run `npm install` once after cloning: it installs the dependencies of the npm workspaces and the git hooks (through [husky](https://typicode.github.io/husky/)) that check every commit title against [Conventional Commits](https://www.conventionalcommits.org/) and refuse to delete a remote branch with open pull requests into or out of it.
