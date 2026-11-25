---
paths:
  - "docs/**"
---

# The report

The report is a plain Jekyll site in `docs/` (the README says how to run it locally), published to GitHub Pages by the CI on every push to `main`. It is a set of chapter pages, each with `title`, `icon` (an emoji, the chapter's icon in the Notion-like sidebar) and `nav_order` front matter, rendered through `docs/_layouts/chapter.html` (sidebar nav built automatically from `nav_order`, the current chapter's headings nested under it).

## Chapters

1. `docs/introduction.md` — Team, Scenario, Deliverables
2. `docs/analysis.md` — pulls in, in order, `docs/_includes/business-requirements.md`, `docs/_includes/subdomains.md` (the subdomains of the business, found from the requirements, with their core/supporting/generic type), `docs/_includes/functional-requirements.md` (user stories, grouped by those subdomains, plus an "Out of scope for now" table of stories kept aside without IDs, so active stories are numbered consecutively), `docs/_includes/quality-attributes.md` (Quality Attributes as QA-xx six-part scenarios: Source → Stimulus → Artifact → Environment → Response → Response measure, grouped by category — Performance, Availability, Data Consistency, Security, Deployability, Modifiability, Accessibility), `docs/_includes/event-storming.md` (the ten steps of the board, numbered, plus the open pain points; the pivotal events confirm the subdomains, and the bounded contexts of step 10 are the bridge to Design) and `docs/_includes/ubiquitous-language.md` (the glossary, one table per bounded context)
3. `docs/design.md` — an intro, then pulls in `docs/_includes/strategic-design.md` (Bounded Contexts, Context Map), `docs/_includes/tactical-design.md` (Tactical Design: the aggregates per bounded context with Mermaid class diagrams, rules across aggregates, roles, changes from the board), `docs/_includes/architecture.md` (Components and Connectors, Hexagonal Architecture), `docs/_includes/microservices.md` (Decomposition, Services, Dependencies at run time, API Composition, State and scaling, Contracts) and `docs/_includes/patterns.md` (catalog of the patterns, Observability, Event delivery), then `docs/_includes/adr.md` (the Architecture Decision Records, ADR-xx, in the course format: Title, Status, Context, Decision, Consequences, Compliance)
4. `docs/implementation.md` — Microservices, Testing, Multiplatform, Experiments, Monitoring
5. `docs/devops.md` — Project Structure, VCS & Repo, Quality Assurance, CI/CD, Deployment, Benchmark; SemVer and releases, the rest of Deployment and Benchmark are written at the end of development
6. `docs/conclusions.md`

The chapter order and headings were agreed with the co-author: when a chapter's content is written, fill its existing stub headings rather than restructuring.

Requirements live only in `docs/_includes/functional-requirements.md` and `docs/_includes/quality-attributes.md` (plain Markdown, included from `docs/analysis.md`) — there is no separate DDD/Gherkin spec anymore, and no `ddd/` or `features/` directory. Don't recreate that structure; extend the two includes instead.

## Pictures

- The context map is generated from `docs/assets/context-map/gotion.cml` by `docs/assets/context-map/render.sh`, which needs the Context Mapper CLI `cm` and Graphviz `dot`.
- The C&C pictures, an overview `gotion` plus one per style (`event-based`, `data-flow`, `repository`), and the `hexagonal` picture are exported from the `.drawio` files in `docs/assets/components-and-connectors/` by `render.sh` next to them, which needs the draw.io CLI (`drawio`, or the command in `$DRAWIO`). Keep `html=0` and no `whiteSpace=wrap` in their styles, or the SVGs embed a PNG per label.
- The pictures `monorepo` and `deployment` are exported from the `.drawio` files in `docs/assets/devops/` by `render.sh` next to them.
