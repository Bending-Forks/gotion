## Functional requirements

Expressed as user stories and grouped by the [subdomains](#subdomains) of the business
they belong to.
Non-functional constraints on these behaviours are specified separately as
[Quality Attributes](#quality-attributes). Stories outside the
current scope are kept aside, without an identifier, in [Out of scope](#out-of-scope-for-now).

Each story has a Gherkin feature below it. The scenarios describe what a user can do
and what they should observe, including the cases where Gotion must refuse an action.

#### Identity

- **US-01 — Sign up and sign in**: As a user, I want to register and authenticate with my email address and password so that I can access Gotion.

```gherkin
Feature: US-01 Sign up and sign in

  Scenario: Register with an unused email address
    Given no user has registered with "alice@example.com"
    When Alice registers with that email address and a valid password
    Then Gotion creates her account
    And she gets a first workspace as its Admin
    And that workspace becomes her main workspace

  Scenario: Refuse an email address already in use
    Given Alice has registered with "alice@example.com"
    When someone tries to register with the same email address
    Then Gotion refuses the registration
    And Alice's account stays unchanged

  Scenario: Sign in with the correct password
    Given Alice has a registered account
    When she signs in with her email address and the correct password
    Then she can access her workspaces

  Scenario: Refuse an incorrect password
    Given Alice has a registered account
    When she tries to sign in with an incorrect password
    Then Gotion refuses the sign-in
    And she cannot access her workspaces through that attempt
```

#### Workspace organisation

- **US-02 — Manage workspaces**: As a user, I want to create, rename, delete, and switch between multiple workspaces, and choose my main one, so that I can keep different projects or teams separate.

A user can be removed from a workspace only if they also belong to another one.
If the removed workspace is their main one, Gotion automatically sets one of their remaining workspaces as main.

```gherkin
Feature: US-02 Manage workspaces

  Scenario: Create a workspace
    Given Alice is signed in
    When she creates a workspace named "Research"
    Then "Research" appears in her workspace directory
    And she is its first Admin
    And it has exactly one root page

  Scenario: Rename a workspace
    Given Alice is an Admin of "Research"
    When she renames it to "Lab notes"
    Then its members see the name "Lab notes"
    And its pages and memberships stay unchanged

  Scenario: Switch workspaces without changing the main one
    Given Alice belongs to "Research" and "Teaching"
    And her main workspace is "Research"
    When she switches to "Teaching"
    Then "Teaching" becomes her active workspace
    And her main workspace is still "Research"

  Scenario: Choose a main workspace
    Given Alice belongs to "Research" and "Teaching"
    When she chooses "Teaching" as her main workspace
    Then Gotion saves "Teaching" as her default workspace

  Scenario: Automatically replace the main workspace after removal by another Admin
    Given Alice and Bob are Admins of "Research"
    And Bob's main workspace is "Research"
    And Bob also belongs to "Teaching"
    When Alice removes Bob from "Research"
    Then Bob no longer belongs to "Research"
    And Alice remains its Admin
    And "Teaching" automatically becomes Bob's main workspace

  Scenario: Refuse removal from a user's only workspace
    Given Alice and Bob are Admins of "Research"
    And Bob's main workspace is "Research"
    And Bob belongs to no other workspace
    When Alice tries to remove Bob from "Research"
    Then Gotion refuses the removal
    And Bob remains an Admin of "Research"
    And "Research" remains his main workspace

  Scenario: Refuse a main workspace the user does not belong to
    Given Alice does not belong to "Research"
    When she tries to choose "Research" as her main workspace
    Then Gotion refuses the change
    And her main workspace stays unchanged

  Scenario: Delete a workspace
    Given Alice is an Admin of "Research"
    And the workspace contains pages, discussions and other members
    When she deletes "Research"
    Then the workspace is no longer available to its members
    And Gotion removes its root page, sub-pages, content and discussions
    And Gotion removes its workspace membership

  Scenario Outline: Refuse workspace administration by other roles
    Given Alice has the <role> role in "Research"
    When she tries to <action> the workspace
    Then Gotion refuses the action
    And the workspace stays unchanged

    Examples:
      | role   | action |
      | Editor | rename |
      | Editor | delete |
      | Viewer | rename |
      | Viewer | delete |
```

#### Membership and roles

- **US-03 — Manage workspace members**: As a workspace Admin, I want to invite people to the workspace, remove members, and assign them the Admin, Editor, or Viewer role so that I can control who can read and who can change its content. A workspace always keeps at least one Admin.

A member can be removed only if they also belong to another workspace.

```gherkin
Feature: US-03 Manage workspace members

  Scenario Outline: Invite a registered user with a role
    Given Alice is an Admin of "Research"
    And Bob is registered with "bob@example.com"
    And Bob is neither a member nor already invited to "Research"
    When Alice invites "bob@example.com" with the <role> role
    Then Bob has a pending invitation to "Research" with that role
    And he does not become a member until he accepts
    When Bob accepts the invitation
    Then he belongs to "Research" with the <role> role
    And the invitation is no longer pending

    Examples:
      | role   |
      | Admin  |
      | Editor |
      | Viewer |

  Scenario: Decline an invitation
    Given Bob has a pending invitation to "Research"
    When he declines it
    Then the invitation is no longer pending
    And he does not become a member of "Research"

  Scenario: Change a member's role
    Given Alice is an Admin of "Research"
    And Bob is a Viewer in that workspace
    When Alice changes Bob's role to Editor
    Then Bob can edit the workspace's pages and blocks

  Scenario: Remove a member
    Given Alice is an Admin of "Research"
    And Bob is an Editor in that workspace
    And Bob's main workspace is "Teaching"
    When Alice removes Bob
    Then Bob no longer belongs to "Research"
    And he can no longer read or change its pages or take part in its discussions
    And "Teaching" remains his main workspace

  Scenario Outline: Keep at least one Admin
    Given Alice is the only Admin of "Research"
    When she tries to <action>
    Then Gotion refuses the action
    And Alice remains an Admin of "Research"

    Examples:
      | action                        |
      | change her own role to Editor |
      | change her own role to Viewer |
      | remove herself                |
      | leave the workspace           |

  Scenario Outline: Refuse membership administration by other roles
    Given Alice has the <role> role in "Research"
    When she tries to <action>
    Then Gotion refuses the action
    And the workspace membership stays unchanged

    Examples:
      | role   | action                 |
      | Editor | invite a user          |
      | Editor | change a member's role |
      | Editor | remove a member        |
      | Viewer | invite a user          |
      | Viewer | change a member's role |
      | Viewer | remove a member        |
```

#### Page content

- **US-04 — Manage pages and blocks**: As an Editor, I want to create, read, update, and delete pages and organize them and their blocks in a tree so that I can structure content hierarchically. Each workspace has exactly one root page, created with the workspace: it holds content like any other page, every new page is created inside it or inside one of its sub-pages, and it is deleted only together with the workspace.

```gherkin
Feature: US-04 Manage pages and blocks

  Scenario: Create nested pages
    Given Alice is an Editor in "Research"
    And she has opened its root page
    When she creates a sub-page named "Experiments" inside it
    And creates a sub-page named "Trial 1" inside "Experiments"
    Then she can open "Experiments" from the root page
    And she can open "Trial 1" from "Experiments"
    And both sub-pages belong to "Research"

  Scenario: Read and update the root page's content
    Given Alice is an Editor in "Research"
    When she adds a text block to its root page
    And opens that page again
    Then she sees the text she added

  Scenario: Delete a page and its descendants permanently
    Given Alice is an Editor in "Research"
    And "Experiments" is a sub-page with content and a sub-page named "Trial 1"
    When she deletes "Experiments"
    Then "Experiments", "Trial 1" and their content are permanently deleted
    And "Experiments" no longer appears in its parent page

  Scenario: Protect the root page
    Given Alice is an Admin of "Research"
    When she tries to delete its root page without deleting the workspace
    Then Gotion refuses the deletion
    And "Research" still has its root page

  Scenario: A Viewer can read but cannot edit
    Given Bob is a Viewer in "Research"
    When he opens a page in that workspace
    Then he can read its content
    When he tries to change the page's content
    Then Gotion refuses the change
    And the content stays unchanged

  Scenario: Refuse page access by a non-member
    Given Bob does not belong to "Research"
    When he requests one of its pages directly by its identifier
    Then Gotion refuses access
    And reveals no page title, metadata or content
```

- **US-05 — Customize page metadata**: As an Editor, I want to set a page title, icon, and cover so that pages are easy to recognize and personalize.

```gherkin
Feature: US-05 Customize page metadata

  Scenario: Set a page's title, icon and cover
    Given Alice is an Editor in "Research"
    And "Experiments" is a sub-page in that workspace
    When she changes its title to "Lab notebook"
    And chooses an icon and a cover image link
    Then the page shows that title, icon and cover
    And its page block in the parent page shows the same metadata
    And its content stays unchanged

  Scenario: Remove optional metadata
    Given Alice is an Editor in "Research"
    And a page has an icon and a cover
    When she removes the icon and cover
    Then the page has neither an icon nor a cover
    And its title and content stay unchanged
```

- **US-06 — Edit Markdown blocks**: As an Editor, I want to work with an ordered, nestable list of blocks so that content remains modular and structured.

```gherkin
Feature: US-06 Edit Markdown blocks

  Background:
    Given Alice is an Editor in "Research"
    And she has opened a page in that workspace

  Scenario: Insert and update a block
    Given the page has no blocks
    When Alice inserts a text block containing "First draft"
    And changes its text to "Reviewed draft"
    Then the page contains one text block with "Reviewed draft"

  Scenario: Reorder blocks
    Given the page has blocks "Question", "Method" and "Result" in that order
    When Alice moves "Result" before "Method"
    Then their order is "Question", "Result", "Method"

  Scenario: Nest a block
    Given the page has blocks "Method" and "Step 1"
    When Alice nests "Step 1" under "Method"
    Then "Step 1" is a child of "Method"

  Scenario: Refuse a cycle in the block tree
    Given "Step 1" is nested under "Method"
    When Alice tries to nest "Method" under "Step 1"
    Then Gotion refuses the move
    And the block tree stays unchanged

  Scenario: Delete a block and its children
    Given "Step 1" and "Step 2" are nested under "Method"
    When Alice deletes "Method"
    Then "Method", "Step 1" and "Step 2" are removed from the page
```

- **US-07 — Use native Markdown block types**: As an Editor, I want to create formatted text, headings, bulleted, numbered, and to-do lists, and code blocks so that I can write rich content with Markdown.

```gherkin
Feature: US-07 Use native Markdown block types

  Scenario Outline: Write content with a supported block type
    Given Alice is an Editor with a page open
    When she creates a <type> block with <content>
    And opens the page again
    Then the block displays <result>

    Examples:
      | type          | content                   | result                        |
      | text          | **Important**             | the word Important in bold    |
      | heading       | level 2 and text Method   | Method as a level 2 heading   |
      | bulleted list | text First item           | First item with a bullet      |
      | numbered list | text First step           | First step with a list number |
      | to-do list    | text Review, unchecked    | Review with an empty checkbox |
      | code          | print("hello")            | the literal code text         |

  Scenario: Check a to-do item
    Given Alice is an Editor with a page open
    And it contains an unchecked to-do item named "Review"
    When she checks "Review"
    And opens the page again
    Then "Review" is still checked

  Scenario: Change a block's type without losing its discussion
    Given Alice is an Editor with a page open
    And a text block has a comment thread
    When she changes that block into a heading
    Then it stays in the same position in the page
    And its comment thread is still attached to it
```

#### Real-time collaboration

- **US-08 — Collaborate in real time**: As a collaborator, I want to see the avatars of the other connected users and co-edit the same page so that we can work together.

```gherkin
Feature: US-08 Collaborate in real time

  Scenario: See who has the page open
    Given Alice and Bob belong to "Research"
    And Alice has a page open
    When Bob opens the same page
    Then Alice sees Bob's avatar among the connected collaborators
    And Bob sees Alice's avatar
    When Bob leaves the page
    Then Alice no longer sees him among its connected collaborators

  Scenario: Merge concurrent edits
    Given Alice and Bob are Editors with the same page open
    When they edit the same block at the same time
    And Gotion acknowledges both edits
    Then both collaborators see the same merged content
    And Gotion does not silently discard either acknowledged edit

  Scenario: Follow edits as a Viewer
    Given Alice is an Editor and Bob is a Viewer in "Research"
    And they have the same page open
    When Alice changes a block
    Then Bob sees the updated content
    When Bob tries to edit that block
    Then Gotion refuses his edit

  Scenario: Close collaboration when a page is deleted
    Given Alice and Bob have a sub-page open
    And Alice is an Editor in its workspace
    When Alice deletes the sub-page
    Then both collaborators learn that the page was deleted
    And Gotion accepts no further edits to it
```

#### Discussion

- **US-09 — Discuss content in context**: As a collaborator, I want to add comment threads to pages or individual blocks, resolve them, and mention a member of the workspace in a comment so that conversations stay connected to the relevant content. Any member of the workspace can comment and resolve threads, whatever their role, Viewers included.

```gherkin
Feature: US-09 Discuss content in context

  Scenario Outline: Open a discussion as a Viewer
    Given Bob is a Viewer in "Research"
    And he has a page open
    When he posts "Can we check this?" on <anchor>
    Then a thread opens on <anchor> with his comment
    And the page's content stays unchanged

    Examples:
      | anchor               |
      | the page             |
      | a block of that page |

  Scenario: Reply and mention another member
    Given Alice and Bob belong to "Research"
    And a page has an unresolved comment thread
    When Alice replies in that thread and mentions Bob
    Then the thread contains Alice's reply with a mention of Bob

  Scenario: Resolve a thread as a Viewer
    Given Bob is a Viewer in "Research"
    And a page has an unresolved comment thread
    When Bob resolves it
    Then the thread is marked as resolved
    And Gotion refuses further comments in that thread

  Scenario Outline: Remove discussions when their anchor is deleted
    Given a comment thread is attached to <anchor>
    When an Editor deletes <anchor>
    Then Gotion removes that thread and its comments

    Examples:
      | anchor     |
      | a sub-page |
      | a block    |
```

#### Notification

- **US-10 — Receive in-app notifications**: As a user, I want to receive in-app notifications about invitations and mentions so that I can stay informed.

```gherkin
Feature: US-10 Receive in-app notifications

  Scenario: Receive a workspace invitation
    Given Bob is registered and signed in
    And Alice is an Admin of "Research"
    And Bob is neither a member nor already invited to that workspace
    When Alice invites Bob to "Research"
    Then Bob receives an in-app notification about the invitation

  Scenario: Receive a mention
    Given Alice and Bob belong to "Research"
    When Alice mentions Bob in a comment
    Then Bob receives an in-app notification about the mention

  Scenario: Mention oneself
    Given Alice belongs to "Research"
    When she mentions herself in a comment
    Then Gotion creates no notification for that mention

  Scenario: Mark a notification as read
    Given Bob has received an unread notification
    When he marks it as read
    Then it appears as read when he opens his notifications again
```

#### Out of scope for now

Stories written before the Event Storming and left out of the current scope, kept here so that the history of the analysis stays traceable.

| Story | Reason |
|---|---|
| **Restore deleted pages** (trash area, restore, permanent delete) | Deleting a page is permanent: it removes the page content and its sub-pages at once. |
| **Review page history** (revisions and their authors) | Not needed by the prototype. |
| **Reuse synchronized content** (synced blocks) | Not needed by the prototype. |
| **Apply granular permissions** (per-page permissions inherited from the workspace) | Replaced by the workspace roles of US-03. |
| **Search the workspace** (full-text search) | Planned as a future extension: it can be added as a new service that listens to the events Editing already publishes. |
