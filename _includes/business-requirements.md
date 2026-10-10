## Business requirements

These goals explain why Gotion is being built instead of adopting an existing tool.

* **BR-01 — Keep data in-house:** Company policies or regulatory obligations may restrict where meeting notes, specifications, and customer data can be stored. Gotion therefore runs on infrastructure controlled by the adopting organization and makes no calls to external services at runtime.

* **BR-02 — Keep costs independent of team size:** Per-user pricing becomes expensive as a team grows, especially when many members only need read access. With Gotion, the organization pays for its infrastructure, not for each user it adds.

* **BR-03 — Avoid vendor lock-in:** Gotion stores content as Markdown, an open plain-text format, so that the content stays readable without Gotion. Using a proprietary format would recreate the dependency the project is intended to remove.

* **BR-04 — Minimize administrative work:** Gotion is intended for small companies and research groups without a dedicated system administrator. Installation, upgrades, and backups must be manageable by one part-time administrator.

* **BR-05 — Make migration familiar:** Teams already using Notion should not have to learn an entirely new way of working. Gotion must support familiar features such as nested pages, collaborative editing, and comments.

* **BR-06 — Make the system auditable and adaptable:** Gotion is released under the GNU General Public License v3. Organizations can inspect how it handles their data, modify it to meet their needs, and verify the privacy guarantees behind BR-01.

### Use cases

These use cases describe how people work with Gotion, from the action that starts a task
to its outcome. The story identifiers refer to the [Functional requirements](#functional-requirements),
where Gherkin scenarios give concrete acceptance examples for these flows. Actors and roles
follow the [Ubiquitous language](#ubiquitous-language); an Admin can also do everything an Editor can.

<section class="use-case" markdown="1">

#### UC-01: Access Gotion

**Actors:** a registered User, or a visitor who needs an account.

**Precondition:** the person can reach the organization's Gotion instance.

**Trigger:** the person wants to access their workspaces.

**Related stories:** US-01, US-02.

**Main flow:**

1. The user provides their email address and password.
2. Gotion checks the credentials and signs the user in.
3. The user opens a workspace they belong to.

**Alternative flows:**

- A visitor registers with an unused email address and a valid password. Gotion creates the account and a first workspace, makes the user its Admin, and sets it as their main workspace. The user can then sign in.
- If the email address is already registered, Gotion refuses the registration and keeps the existing account unchanged.
- If the credentials are incorrect, Gotion refuses the sign-in. Repeated failed attempts are throttled as specified in [QA-07](#security).

**Outcome:** the user is signed in and can access their workspaces. A failed attempt grants no access.

</section>

<section class="use-case" markdown="1">

#### UC-02: Organize work in a workspace

**Actor:** a User; renaming or deleting an existing workspace requires its Admin role.

**Precondition:** the user is signed in.

**Trigger:** the user needs a separate space for a project or team.

**Related stories:** US-02, US-03, US-04.

**Main flow:**

1. The user creates a workspace and gives it a name.
2. Gotion adds the workspace to their directory, makes them its first Admin, and creates its root page.
3. The user opens the workspace and starts working in it.
4. The user chooses it as their main workspace if they want it to be their default.

**Alternative flows:**

- The user opens an existing workspace from their directory. Switching changes the active workspace and keeps the main workspace unchanged.
- The user chooses another workspace they belong to as main. Gotion saves the preference; it refuses a workspace the user does not belong to.
- An Admin renames a workspace. Its members see the new name, while its pages and memberships stay unchanged.
- An Admin deletes a workspace. Gotion makes it unavailable to its members and removes its membership, pages, content and discussions.
- Gotion refuses a blank workspace name, or a rename or deletion requested by an Editor or Viewer.

**Outcome:** the user can organize and navigate their workspaces, with a separate preference for the main one.

</section>

<section class="use-case" markdown="1">

#### UC-03: Invite someone to a workspace

**Actors:** the workspace Admin and the Invitee.

**Preconditions:** the Admin is signed in, and the invitee has a registered Gotion account.

**Trigger:** the Admin wants another person to join the workspace.

**Related stories:** US-03, US-10.

**Main flow:**

1. The Admin enters the invitee's email address and chooses the Admin, Editor or Viewer role.
2. Gotion checks that the user is registered and is neither a member nor already invited to that workspace.
3. Gotion records the pending invitation and sends the invitee an in-app notification.
4. The invitee opens the invitation and accepts it.
5. Gotion adds them to the workspace with the chosen role and ends the invitation.

**Alternative flows:**

- The invitee declines. Gotion ends the invitation without adding a member.
- The invitee leaves the invitation unanswered. It stays pending and does not expire.
- If the address is not registered, or the user already belongs to the workspace or has a pending invitation, Gotion refuses the invitation.
- Gotion refuses an invitation sent by an Editor or Viewer. Only the invitee can accept or decline their invitation.

**Outcome:** the invitee becomes a member only after accepting, with the role chosen by the Admin.

</section>

<section class="use-case" markdown="1">

#### UC-04: Change workspace membership

**Actors:** the workspace Admin and the member whose access changes.

**Preconditions:** the Admin is signed in, and the person whose access changes is a member of that workspace.

**Trigger:** the Admin needs to change a member's role or remove their access.

**Related stories:** US-02, US-03.

**Main flow:**

1. The Admin selects a member and requests their removal.
2. Gotion checks that the workspace will keep at least one Admin and that the member belongs to at least one other workspace.
3. Gotion removes the member. They can no longer read or change the workspace's pages or take part in its discussions.
4. If this was the removed member's main workspace, Gotion automatically sets one of their remaining workspaces as main. Otherwise, their main workspace stays unchanged.

**Alternative flows:**

- The Admin changes the member's role instead. Gotion applies the new role, provided the workspace keeps at least one Admin.
- Gotion refuses removal from a user's only workspace. Their membership and main workspace stay unchanged.
- Gotion refuses removal or demotion of the last Admin. Another member must first become an Admin.
- Gotion refuses membership administration requested by an Editor or Viewer.

**Outcome:** the member's access reflects the accepted change. Removal leaves them in at least one workspace, and the original workspace keeps an Admin.

</section>

<section class="use-case" markdown="1">

#### UC-05: Write and organize a page

**Actor:** an Editor or Admin of the workspace.

**Preconditions:** the actor is signed in and has opened a page in the workspace.

**Trigger:** the actor wants to record or reorganize information.

**Related stories:** US-04, US-05, US-06, US-07.

**Main flow:**

1. The Editor creates a sub-page inside the open page.
2. Gotion adds its page block to the parent page and makes the sub-page available to workspace members.
3. The Editor sets the page's title and, if needed, an icon and a cover image link.
4. The Editor writes content using text, headings, bulleted, numbered or to-do lists, and code blocks.
5. The Editor updates, reorders or nests blocks to structure the content. Gotion saves the accepted changes, which the Editor sees when opening the page again.

**Alternative flows:**

- The Editor works on an existing page, including the root page, instead of creating a sub-page.
- The Editor changes a content block's type. The block keeps its position and attached discussions; a page block cannot change into another type or be created by converting a content block.
- The Editor deletes a sub-page. Gotion permanently removes its content and sub-pages, closes its editing session, and removes its discussions. Deleting a block also removes its nested blocks and their attached discussions; any sub-pages represented by deleted page blocks are removed too.
- Gotion refuses a move that would nest a block under itself or one of its descendants, and refuses deletion of the root page while the workspace exists.
- A Viewer opens the page to read it. Gotion refuses their attempts to change content or metadata, and refuses all page access by non-members.

**Outcome:** workspace members can read the saved page and its place in the hierarchy. Deleted content cannot be restored.

</section>

<section class="use-case" markdown="1">

#### UC-06: Work on a page together

**Actors:** workspace members as Collaborators. Editors and Admins can submit edits; Viewers can follow them.

**Preconditions:** the page exists, and the collaborators are signed in and connected to Gotion.

**Trigger:** a member opens a page that another member is working on.

**Related stories:** US-04, US-08.

**Main flow:**

1. The member opens the page and joins its editing session.
2. Gotion shows the avatars of the connected collaborators to everyone in that session.
3. Editors submit changes to the page. Gotion merges concurrent edits and applies the result to its content.
4. The collaborators see the same merged content, without Gotion silently discarding acknowledged edits.

**Alternative flows:**

- A Viewer joins, sees the connected collaborators and follows their edits. Gotion refuses edits submitted by the Viewer.
- A collaborator leaves the page. Their avatar disappears from its presence list.
- An Editor deletes the page. Gotion closes the session, tells its participants that the page was deleted, and accepts no further edits to it.
- A collaborator loses their connection. Editing requires a connection to the server; offline editing is outside the current scope.

**Outcome:** the connected collaborators share the same page content. The timing and convergence measures are specified in [Quality Attributes](#quality-attributes).

</section>

<section class="use-case" markdown="1">

#### UC-07: Discuss content and mention a member

**Actors:** workspace members as Collaborators, including Viewers, and any member mentioned in a comment.

**Preconditions:** the author is signed in, belongs to the workspace, and can access the page or block being discussed.

**Trigger:** a member has a question or feedback about the content.

**Related stories:** US-09, US-10.

**Main flow:**

1. The member chooses the page or a block as the discussion's anchor and posts a comment.
2. Gotion opens a thread at that anchor with the first comment.
3. Other workspace members reply in the thread. A member mentions another workspace member in a comment.
4. Gotion raises an in-app notification for the mentioned member.
5. When the discussion is over, a workspace member resolves the thread.

**Alternative flows:**

- A member replies to an existing unresolved thread instead of opening one.
- The members discuss without mentioning anyone. Gotion creates no mention notification.
- A comment mentions its own author. Gotion creates no notification for that mention.
- Gotion refuses comments or resolution by non-members, and refuses mentions of users outside the workspace.
- Gotion refuses further comments in a resolved thread.
- The anchored page or block is deleted. Gotion removes its threads and their comments.

**Outcome:** the discussion stays attached to the content until its anchor is deleted. Posting or resolving comments does not change the page's content.

</section>

<section class="use-case" markdown="1">

#### UC-08: Read an in-app notification

**Actor:** the notification's Recipient.

**Preconditions:** the recipient is signed in, and Gotion has delivered an invitation or mention notification to them.

**Trigger:** the recipient checks their notifications.

**Related story:** US-10.

**Main flow:**

1. The recipient opens their in-app notifications.
2. Gotion shows the notification and whether it concerns a workspace invitation or a mention.
3. The recipient reads it and marks it as read.
4. Gotion keeps the read status when the recipient opens their notifications again.

**Alternative flows:**

- Delivery is best effort. Repeated delivery of the same notification does not create a second notification or reset its read status.
- Someone other than the recipient tries to mark the notification as read. Gotion refuses the change.

**Outcome:** the recipient has read the notification and Gotion records that status. Reading an invitation notification does not itself accept the invitation.

</section>
