## Functional requirements

Expressed as user stories and grouped by the bounded contexts found with the Event Storming.
Non-functional constraints on these behaviours are specified separately as
[Non functional requirements](#non-functional-requirements). Stories outside the
current scope are kept aside, without an identifier, in [Out of scope](#out-of-scope-for-now).

### Account

- **US-01 — Sign up and sign in**: As a user, I want to register and authenticate with my email address and password so that I can access Gotion.
- **US-02 — Manage workspaces**: As a user, I want to create, rename, delete, and switch between multiple workspaces, and choose my main one, so that I can keep different projects or teams separate.

### Membership

- **US-03 — Manage workspace members**: As a workspace Admin, I want to invite people to the workspace, remove members, and assign them the Admin, Editor, or Viewer role so that I can control who can read and who can change its content. A workspace always keeps at least one Admin.

### Editing

- **US-04 — Manage pages and blocks**: As an Editor, I want to create, read, update, and delete pages and organize them and their blocks in a tree so that I can structure content hierarchically. Each workspace has exactly one root page, created with the workspace: it holds content like any other page, every new page is created inside it or inside one of its sub-pages, and it is deleted only together with the workspace.
- **US-05 — Customize page metadata**: As an Editor, I want to set a page title, icon, and cover so that pages are easy to recognize and personalize.
- **US-06 — Edit Markdown blocks**: As an Editor, I want to work with an ordered, nestable list of blocks so that content remains modular and structured.
- **US-07 — Use native Markdown block types**: As an Editor, I want to create formatted text, headings, bulleted, numbered, and to-do lists, and code blocks so that I can write rich content with Markdown.
- **US-08 — Collaborate in real time**: As a collaborator, I want to see the avatars of the other connected users and co-edit the same page so that we can work together.

### Discussion

- **US-09 — Discuss content in context**: As a collaborator, I want to add comment threads to pages or individual blocks, resolve them, and mention a member of the workspace in a comment so that conversations stay connected to the relevant content.

### Notification

- **US-10 — Receive in-app notifications**: As a user, I want to receive in-app notifications about invitations and mentions so that I can stay informed.

### Out of scope for now

Stories written before the Event Storming and left out of the current scope, kept here so that the history of the analysis stays traceable.

| Story | Reason |
|---|---|
| **Restore deleted pages** (trash area, restore, permanent delete) | Deleting a page is permanent: it removes the page content and its sub-pages at once. |
| **Review page history** (revisions and their authors) | Not needed by the prototype. |
| **Reuse synchronized content** (synced blocks) | Not needed by the prototype. |
| **Apply granular permissions** (per-page permissions inherited from the workspace) | Replaced by the workspace roles of US-03. |
| **Search the workspace** (full-text search) | Planned as a future extension: it can be added as a new service that listens to the events Editing already publishes. |
