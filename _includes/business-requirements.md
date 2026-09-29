## Business requirements

These goals explain why Gotion is being built instead of adopting an existing tool.

* **BR-01 — Keep data in-house:** Company policies or regulatory obligations may restrict where meeting notes, specifications, and customer data can be stored. Gotion therefore runs on infrastructure controlled by the adopting organization and makes no calls to external services at runtime.

* **BR-02 — Keep costs independent of team size:** Per-user pricing becomes expensive as a team grows, especially when many members only need read access. With Gotion, the organization pays for its infrastructure, not for each user it adds.

* **BR-03 — Avoid vendor lock-in:** Gotion stores content as Markdown. Teams can export their workspace and continue reading or editing it without Gotion. Using a proprietary format would recreate the dependency the project is intended to remove.

* **BR-04 — Minimize administrative work:** Gotion is intended for small companies and research groups without a dedicated system administrator. Installation, upgrades, and backups must be manageable by one part-time administrator.

* **BR-05 — Make migration familiar:** Teams already using Notion should not have to learn an entirely new way of working. Gotion must support familiar features such as nested pages, collaborative editing, comments, and search.

* **BR-06 — Make the system auditable and adaptable:** Gotion is released under the GNU General Public License v3. Organizations can inspect how it handles their data, modify it to meet their needs, and verify the privacy guarantees behind BR-01.
