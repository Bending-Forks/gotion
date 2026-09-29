---
title: Introduction
nav_order: 1
---

## Team

| Name | Contact |
|---|---|
| Elvis Perlika | elvis.perlika@studio.unibo.it |
| Giosue Giocondo Mainardi | giosue.mainardi@studio.unibo.it |

## Scenario

Gotion is a self-hosted workspace for notes and documentation. Content is organized into pages of nested blocks, with real-time editing, comments, search, and page-level permissions.

Many small teams keep specifications, meeting notes, and internal procedures in hosted tools such as Notion. This content becomes the organization’s memory, but remains on infrastructure the team does not control. Internal policies, data-protection obligations, or funding terms may prevent some teams from using such services.

Common alternatives sacrifice useful features. Shared `.docx` files lack structure and reliable collaborative editing, while traditional wikis lack the block-based editor users already know.

Gotion is a B2B product. Its scope comes from interviews with target customers: small teams that already run their documentation on Notion, asked what they keep there and what they would need before moving it in-house.

Gotion runs on infrastructure controlled by the organization. Its microservice architecture separates core functions into independent services, making the system easier to deploy, maintain, and scale.

## Deliverables

## Ubiquitous language

Each word below has exactly one meaning, in this report, in the code, and in the API: a block is a `Block` in the source, never a `Node` or an `Item`.

| Term | Meaning |
|---|---|
| Workspace | The top-level container. It owns its members and pages, and bounds every search and permission check. |
| Member | A user who belongs to a workspace and holds exactly one role there. |
| Page | A named tree of blocks, with an icon and a cover. The unit of sharing and of version history. |
| Block | The unit of content. Typed (paragraph, heading, list item, to-do, code), ordered among its siblings, and nestable. |
| Synced block | A block with a single source whose content appears in several pages at once. |
| Revision | A recorded state of a page, attributed to the member who wrote it. |
| Trash | Where a deleted page waits to be restored or purged. |
| Permission | The access a member holds on a page. Inherited from the parent page unless set explicitly. |
| Thread | Comments anchored to a page or to a block. |
| Mention | A reference to a member written `@username` inside a block or a comment. It raises a notification. |
| Presence | The members currently viewing a page, and where their cursors are. |

The three roles differ in what a member may do without an explicit grant. *Member* names both the person and the middle role; where the difference matters, the report says *the Member role*.

| Role | Scope |
|---|---|
| Admin | Manages the workspace itself: its members, their roles, and the default permissions on its pages. Everything a Member may do, plus that. |
| Member | Full access to the workspace page tree by default, narrowed or widened page by page. Cannot change membership or roles. |
| Guest | No access by default. Reaches only the pages shared explicitly, which is the usual case for someone outside the organization. |
