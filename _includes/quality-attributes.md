## Quality Attributes

Non-functional requirements, expressed as six-part scenarios (*source, stimulus,
artifact, environment, response, response measure*). Each scenario is testable:
the response measure is the acceptance criterion.

The reference deployment for every scenario is a **single self-hosted node with
4 vCPU and 8 GB RAM**, serving a workspace of **50 members, 10 000 pages and
1 000 000 blocks**, unless a scenario states otherwise.

#### Performance

**QA-01 — Editor input latency** *(constrains US-06, US-07)*

| Part | Value |
|---|---|
| Source | User typing in the editor |
| Stimulus | Inserts a character into a block |
| Artifact | Editor client and block persistence path |
| Environment | Normal operation, page containing 500 blocks |
| Response | Character is rendered locally and durably persisted |
| Response measure | Local render ≤ 50 ms (p95); server acknowledgement ≤ 500 ms (p95) |

**QA-02 — Real-time propagation latency** *(constrains US-08)*

| Part | Value |
|---|---|
| Source | Remote collaborator |
| Stimulus | Edits a block on a page open in other clients |
| Artifact | Synchronization channel |
| Environment | Normal operation, 5 concurrent editors on the same page |
| Response | Change is applied and rendered in every other connected client |
| Response measure | ≤ 300 ms (p95), ≤ 1 s (p99) from acknowledgement to remote render |

**QA-03 — Page open time** *(constrains US-04)*

| Part | Value |
|---|---|
| Source | User |
| Stimulus | Opens a page from the sidebar |
| Artifact | Page loading and rendering path |
| Environment | Cold client cache, page containing 500 blocks |
| Response | Page is rendered and accepts input |
| Response measure | Interactive within 1.5 s (p95) |

#### Availability

**QA-04 — Process crash without data loss** *(constrains US-04, US-06)*

| Part | Value |
|---|---|
| Source | Infrastructure fault |
| Stimulus | The server process terminates abnormally |
| Artifact | Persistence layer |
| Environment | Normal operation, edits in flight |
| Response | The service restarts; every acknowledged edit survives |
| Response measure | Zero loss of acknowledged edits; service available again within 60 s |

#### Data Consistency

**QA-05 — Concurrent edit convergence** *(constrains US-08)*

| Part | Value |
|---|---|
| Source | Multiple collaborators |
| Stimulus | 10 users edit the same block simultaneously |
| Artifact | Synchronization engine |
| Environment | Normal operation, client-server round-trip up to 500 ms |
| Response | All replicas converge to an identical document state; no acknowledged edit is silently discarded |
| Response measure | 100 % convergence within 2 s of the last edit, verified by an automated test over 1 000 randomized operation interleavings |

#### Security

**QA-06 — Unauthorized page access** *(constrains US-03)*

| Part | Value |
|---|---|
| Source | Authenticated user who is not a member of the workspace, or a Viewer of it |
| Stimulus | Requests a page directly by identifier, or submits a change to it, bypassing the UI |
| Artifact | Authorization layer |
| Environment | Normal operation |
| Response | The request is denied |
| Response measure | 100 % of such requests denied; for a non-member, responses for "forbidden" and "non-existent" are indistinguishable, leaking no title or metadata |

**QA-07 — Brute-force login** *(constrains US-01)*

| Part | Value |
|---|---|
| Source | Attacker |
| Stimulus | Attempts repeated logins against one account, guessing its password |
| Artifact | Authentication subsystem |
| Environment | Normal operation |
| Response | Repeated failed attempts are throttled |
| Response measure | More than 5 failed attempts per account per 15 minutes triggers rate limiting |

#### Deployability

**QA-08 — Fresh self-hosted installation**

| Part | Value |
|---|---|
| Source | System administrator |
| Stimulus | Deploys Gotion on a clean Linux host |
| Artifact | The whole system |
| Environment | No pre-existing dependencies beyond a container runtime |
| Response | A running instance with an initial administrator account |
| Response measure | Reachable within 10 minutes using one documented command; schema migrations run automatically, with no manual database step |

#### Modifiability

**QA-09 — Adding a block type** *(constrains US-07)*

| Part | Value |
|---|---|
| Source | Developer |
| Stimulus | Adds a new block type, for example a table |
| Artifact | Block model, editor, renderer |
| Environment | Development time |
| Response | The type is available end to end: creation, persistence, rendering |
| Response measure | Changes confined to the definition and the rendering of the new type; no change to real-time synchronization or to the persistence schema |

#### Accessibility

**QA-10 — Keyboard-only and assistive-technology editing** *(constrains US-06, US-07)*

| Part | Value |
|---|---|
| Source | User relying on a keyboard or a screen reader |
| Stimulus | Creates, reorders, nests, and deletes blocks without a pointing device |
| Artifact | Editor user interface |
| Environment | Normal operation, screen reader active |
| Response | Every block operation is reachable and announced |
| Response measure | 100 % of block operations keyboard-accessible; editor and navigation conform to WCAG 2.1 level AA |

#### Out of scope for now

| Scenario | Reason |
|---|---|
| **Search response time** | Search left the scope together with the search story. |
| **Editing during network interruption** (offline editing, reconciled on reconnect) | Not covered: editing a page requires a connection to the server. |
