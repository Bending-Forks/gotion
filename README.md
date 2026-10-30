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

## Contributing

Run `npm install` once after cloning: it installs the git hooks (through [husky](https://typicode.github.io/husky/)) that check every commit title against [Conventional Commits](https://www.conventionalcommits.org/).
