---
title: Design
nav_order: 4
---

## Event Storming

The domain was explored with an [Event Storming](https://www.eventstorming.com) session,
following the ten steps taught in the course, after Alberto Brandolini and chapter 12 of
Khononov. The process is iterative: the model is enriched one step at a time, and every step is
shown below.

The board is on [Miro](https://miro.com/): [Gotion Event Storming](https://miro.com/app/board/uXjVHlfP04g=/).
Each section below links to the frame holding the wall at that step.

The colour of a sticky is its meaning, not decoration. The legend is kept on the board.

<!-- TODO legend: link to the legend on the board, e.g.
[Open the legend on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=WIDGET_ID)
-->

<!-- TODO legend: export the legend as an image and uncomment
![Event Storming legend]({{ '/assets/event-storming/00-legend.png' | relative_url }})
-->

The grammar reads **read model → actor + command → aggregate → domain event** for a
human-driven slice, and **domain event → policy → command → aggregate → domain event** for an
automated one. By the end of step 8 every command must be executed by an actor, triggered by a
policy, or called by an external system. Actor and aggregate are both yellow and are told apart
by size: the actor is the small sticky on its command, the aggregate the large one. Pain points
are pink diamonds, and pivotal events are vertical bars rather than stickies.

### Unstructured Exploration

Each team member wrote the domain events that can happen in the system on orange stickies, in the past tense, and put them on the board without any order and without worrying about duplicates.

<!-- TODO step 1: link to the frame of this step on the board, e.g.
[Open step 1 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 1: export the frame as an image and uncomment
![Step 1, Unstructured Exploration]({{ '/assets/event-storming/01-unstructured-exploration.png' | relative_url }})
-->

### Timeline

The domain events were organised in the order in which they occur in the business domain, starting from the happy path and branching out from there.

<!-- TODO step 2: link to the frame of this step on the board, e.g.
[Open step 2 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 2: export the frame as an image and uncomment
![Step 2, Timeline]({{ '/assets/event-storming/02-timeline.png' | relative_url }})
-->

### Pain Points

We went back over the timeline to spot the points that need attention: bottlenecks, manual steps, missing domain knowledge. They are pink diamonds placed on the event they concern, so that a debate never stalls the session.

<!-- TODO step 3: link to the frame of this step on the board, e.g.
[Open step 3 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 3: export the frame as an image and uncomment
![Step 3, Pain Points]({{ '/assets/event-storming/03-pain-points.png' | relative_url }})
-->

### Pivotal Points

The events where the context or the phase changes are marked with a vertical bar dividing the events before and after. They are the first indicator of bounded context boundaries.

<!-- TODO step 4: link to the frame of this step on the board, e.g.
[Open step 4 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 4: export the frame as an image and uncomment
![Step 4, Pivotal Points]({{ '/assets/event-storming/04-pivotal-points.png' | relative_url }})
-->

### Commands

The command that triggers each event or flow of events: light blue, written in the imperative, and placed before the event it produces. Where a person in a role issues it, a small yellow actor sits on the command.

<!-- TODO step 5: link to the frame of this step on the board, e.g.
[Open step 5 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 5: export the frame as an image and uncomment
![Step 5, Commands]({{ '/assets/event-storming/05-commands.png' | relative_url }})
-->

### Policies

The commands left without an actor are executed by an automation policy: an event triggers the command. Purple, worded *when X then Y*, between the event and the command it fires.

<!-- TODO step 6: link to the frame of this step on the board, e.g.
[Open step 6 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 6: export the frame as an image and uncomment
![Step 6, Policies]({{ '/assets/event-storming/06-policies.png' | relative_url }})
-->

### Read Models

The view over the data that an actor reads before deciding to execute a command: a screen, a report, a notification. Green, placed before the command.

<!-- TODO step 7: link to the frame of this step on the board, e.g.
[Open step 7 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 7: export the frame as an image and uncomment
![Step 7, Read Models]({{ '/assets/event-storming/07-read-models.png' | relative_url }})
-->

### External Systems

Pink: anything that is not part of the domain being explored, and that either issues a command in or is notified of an event out through a policy. No external system is in scope for Gotion. This step is also the completeness check of the method: by the end of it every command is executed by an actor or triggered by a policy.

<!-- TODO step 8: link to the frame of this step on the board, e.g.
[Open step 8 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=FRAME_ID)
-->

<!-- TODO step 8: export the frame as an image and uncomment
![Step 8, External Systems]({{ '/assets/event-storming/08-external-systems.png' | relative_url }})
-->

### Aggregates

Commands and events were regrouped into transactional consistency boundaries. Each aggregate is a large yellow sticky that receives commands on its left and produces events on its right. Eight emerged: `User`, `Workspace`, `Workspace Membership`, `Page`, `Page Block Tree`, `Real-time Editing Session`, `Notification`, `Comment Thread`.

[Open step 9 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=3458764685226402556)

<!-- TODO step 9: export the frame as an image and uncomment
![Step 9, Aggregates]({{ '/assets/event-storming/09-aggregates.png' | relative_url }})
-->

### Bounded Contexts

Finally the aggregates that belong together functionally were grouped, and a boundary was drawn around each group. Those groups are the candidate bounded contexts, and the candidate microservices.

[Open step 10 on the board](https://miro.com/app/board/uXjVHlfP04g=/?moveToWidget=3458764685221195165)

<!-- TODO step 10: export the frame as an image and uncomment
![Step 10, Bounded Contexts]({{ '/assets/event-storming/10-bounded-contexts.png' | relative_url }})
-->

The identified bounded contexts are:

- `Account`: who the user is, and the workspaces they work in (`User`, `Workspace`).
- `Membership`: who belongs to each workspace and with which role (`Workspace Membership`).
- `Editing`: the pages, their content and the real-time editing of a page (`Page`, `Page Block Tree`, `Real-time Editing Session`).
- `Notification`: what reaches the user (`Notification`).
- `Discussion`: the conversation attached to the content (`Comment Thread`).

The policies that cross those boundaries are the integration points of the future microservices:

| From | Event | Policy | To |
|---|---|---|---|
| Account | Workspace Created | Accept the creator as Admin | Membership |
| Account | Workspace Created | Create its root page | Editing |
| Account | Workspace Deleted | Delete its root page | Editing |
| Membership | Member Invited | Send the invitation | Notification |
| Discussion | Comment Posted | Notify the mentioned user | Notification |

### Open pain points

The pain points still open at the end of the session, each traced to the user story or quality
attribute scenario it puts at risk. The architectural ones are settled in an Architecture
Decision Record, the others in the domain model.

<!-- TODO: verify this table against the pain points of step 3 when steps 1-8 are updated. -->

| Pain point | Context | Traces to |
|---|---|---|
| **PP-01** — Where concurrent edits are ordered and merged: a central sequencer in the Editing service, or replicas that merge on their own | Editing | US-08, QA-02, QA-05 |
| **PP-02** — Whether an invitation expires, and what happens when it is refused | Membership | US-03 |
| **PP-03** — How a member leaves a workspace, given that the last Admin cannot | Membership | US-03 |
| **PP-04** — How Editing and Discussion enforce the roles held by Membership: no policy on the board carries them out of Membership | Membership, Editing, Discussion | US-03, QA-06 |
| **PP-05** — What happens to the comment threads of a deleted page, block or workspace, and to the Workspace Membership of a deleted workspace: no policy removes them | Discussion, Membership | US-02, US-04, US-09 |

## Bounded Contexts

## Architecture

## Microservices

## Patterns
