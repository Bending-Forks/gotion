# gotion

🗒️ Self hosted Notion clone.

## Run the report locally

The report is a plain [Jekyll](https://jekyllrb.com/) site with no Gemfile and no plugins, so only Ruby and the `jekyll` gem are needed:

```sh
gem install jekyll
jekyll serve --livereload
```

Then open <http://127.0.0.1:4000/gotion/>. The `/gotion` path comes from `baseurl` in `_config.yml`, the same path GitHub Pages serves it under.

## Contributing

Run `npm install` once after cloning: it installs the git hooks (through [husky](https://typicode.github.io/husky/)) that check every commit title against [Conventional Commits](https://www.conventionalcommits.org/).
