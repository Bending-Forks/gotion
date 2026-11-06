## Microservices

Each bounded context of the [strategic design](#bounded-contexts) runs as one microservice. This
section says why the system is split that way, and what each service offers and needs. The
patterns the services rely on are in [Patterns](#patterns).

### Decomposition

The system is decomposed by subdomain. Each [subdomain](analysis.html#subdomains) belongs to one
bounded context, and each bounded context is one service, with its own process, container
image, database and deployment.

| Service | Subdomains | Type | User stories | Runtime |
|---|---|---|---|---|
| Account | Identity, Workspace organisation | Generic, supporting | US-01, US-02 | Go |
| Membership | Membership and roles | Supporting | US-03 | Go |
| Editing | Page content, Real-time collaboration | Core | US-04, US-05, US-06, US-07, US-08 | Node.js |
| Discussion | Discussion | Supporting | US-09 | Go |
| Notification | Notification | Generic | US-10 | Go |

The runtimes are settled by
[ADR-04](#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go).

With one service per bounded context, the boundary of a model is also the boundary of a
deployment: a change to a model is a change to one service, which is built, tested, versioned
and deployed alone. Three scenarios rely on it:

- **QA-09.** A new block type changes Editing and the client, and no other service.
- **QA-08.** Each service migrates its own schema, so no migration needs two services at once.
- **QA-04.** A crash of Editing stops the editing of pages, not signing in, inviting or
  commenting: no other service calls Editing while it runs a command.

**Why not smaller services.** A further split would put a network call inside a rule that one
service now keeps on its own:

- Splitting page content from real-time collaboration would put a hop between the session and
  the Page Block Tree. The tree checks every operation before the ack, so the hop would be on
  the path of every keystroke, which QA-01 and QA-02 bound. The same holds for a service per
  aggregate of Editing.
- Splitting identity from workspace organisation would turn two steps of Account into calls
  between services: a workspace is created through `createWorkspace` on User, so that it always
  has a registered creator, and the main workspace is a preference kept on User. Identity is a
  generic subdomain, so if it is later covered by an existing component, Account is where that
  component plugs in, and the split can be made then.

**Why not fewer services.** Two merges were worth weighing:

- **Account with Membership.** They are the tightest pair of the
  [context map](#context-map): each publishes events the other consumes, and each queries the
  other while it runs a command
  ([ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)).
  One service would drop both queries. They stay apart because Membership is the upstream of
  four contexts, all of them through the roles, while the identity in Account may be replaced
  by an existing component: together, replacing identity would touch the service that every
  other context asks for the roles. If the two keep changing together, the merge is the first
  decision to revisit.
- **Notification inside Discussion,** which raises the mentions. Notification also tells
  about invitations, which come from Membership, so inside Discussion it would make Discussion
  consume the events of Membership again, which ADR-03 removed. On its own, Notification only
  subscribes, and no service depends on it at run time.
