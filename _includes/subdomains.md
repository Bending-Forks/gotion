## Subdomains

Subdomains are discovered, bounded contexts are designed. The subdomains exist in the business
before any design: they are the areas of activity that the [business requirements](#business-requirements)
and the interviews behind the [Scenario](introduction.html#scenario) describe, and the
[user stories](#functional-requirements) are grouped by them. The
[Event Storming](#event-storming) later confirmed them: each one is opened by a pivotal event of
the timeline.

| Subdomain | What it covers | User stories | Type |
|---|---|---|---|
| Identity | Registering and signing in | US-01 | Generic |
| Workspace organisation | The workspaces a user creates, renames, deletes and switches between, and the main one | US-02 | Supporting |
| Membership and roles | Who belongs to a workspace, invitations, and the Admin, Editor and Viewer roles | US-03 | Supporting |
| Page content | Nested pages made of Markdown blocks | US-04, US-05, US-06, US-07 | Core |
| Real-time collaboration | Editing a page together, and seeing who else is on it | US-08 | Core |
| Discussion | Comment threads on pages and blocks, and mentions | US-09 | Supporting |
| Notification | In-app notifications about invitations and mentions | US-10 | Generic |

A **core** subdomain is complex and is what sets the product apart, a **supporting** one is specific to the product but simple and gives no advantage, a **generic** one is complex or not but solved the same way by everyone.

- **Core: page content and real-time collaboration.** They are why a team would move to Gotion
  instead of shared `.docx` files or a wiki ([Scenario](introduction.html#scenario), BR-05):
  nested pages made of Markdown blocks (BR-03), edited together and live. They are also the
  hardest part: QA-01, QA-02 and QA-05 all constrain them, and the Event Storming leaves PP-01 open here. They get
  the most care in the model and in the code.
- **Supporting: workspace organisation, membership and roles, discussion.** They follow rules of
  our own (one root page per workspace, the last Admin, threads anchored to blocks), but the
  logic is mostly creating and updating records, and no team picks Gotion for them.
- **Generic: identity and notification.** Signing in with an email address and a password, and
  an in-app inbox, work the same everywhere. So it opens the possibility to adopt an existing solution
  rather than build one, but BR-01 narrows that choice: Gotion makes no calls to external services at
  runtime, so a generic subdomain can be covered by a library or a self-hosted component, not by
  a hosted service.
