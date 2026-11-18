---
name: aggregate
description: Implement or change an aggregate of a service's bounded context (Account, Membership, Editing, Discussion, Notification) - its root, entities, value objects, factory, repository port, the application service of each command, and their tests. Use it for any task that adds a command, an invariant or a domain event to a service's domain model.
---

# Aggregate

The model is already designed in the report: the code follows it, and a change to the model goes back into the report in the same PR.

## 1. Read the model first

- `docs/_includes/tactical-design.md`: the section of the aggregate (class diagram, rules, and the command table with who issues each command and the event it raises), the three rules under *Building blocks*, and *Rules across aggregates* for the policies.
- `docs/_includes/ubiquitous-language.md`: types, methods, errors and events take the terms of the glossary of that context, never a technical synonym.
- The user story or QA scenario the command traces to.

## 2. Domain (`internal/domain/`, `src/domain/` in Editing)

- **Value objects** for every concept with a rule on its value (`WorkspaceName` never blank, `PasswordHash`): immutable, validated by their constructor, which returns an error instead of an invalid value. An operation returns a new value; equality is by value.
- **Entities** keep an identity that never changes. Inner entities are reached only through the root.
- **The root** has one method per command of the table. It checks the invariants, changes the state and returns the domain events it raises. It doesn't publish them, persist itself or call a port.
- A check on data outside the aggregate (an email no other user has, a role held by Membership) is a precondition of the command, not an invariant: it belongs to the application service.
- **A factory** only where creating the aggregate has a rule to keep; otherwise a plain constructor.
- Other aggregates are held by identity (`WorkspaceId`), never by reference.

## 3. Application service (`internal/app/`, `src/app/` in Editing)

One per command, policy or query, in this order:

1. check the preconditions through their ports;
2. load the aggregate whole from its repository, one port per root that loads and saves the whole aggregate;
3. call the method of the root;
4. save the aggregate and hand the events it returned to the publisher port, in the same transaction (the outbox in the Go services, ADR-05; Editing follows its own rule).

One command changes one aggregate. A rule that spans two aggregates is a policy reacting to an event: see the `domain-event` skill.

## 4. Tests

Pick the kind of test by the role of the class:

- **Root, entities, value objects**: sociable unit tests on the real objects, with no mocks. One test per invariant and per command, refusals included, named after the rule they check.
- **Application service**: solitary, with the ports replaced by in-memory fakes. Check that a failed precondition changes nothing, and that the events reach the publisher.
- **Adapters** are tested against a real PostgreSQL or Kafka, and through the contract tests (`service-contract` skill).

## 5. Keep the report true

If the code needs a change of the model (a new invariant, command or event, a renamed term), update in the same PR the aggregate in `tactical-design.md` (diagram and command table), the glossary, and *Rules across aggregates* when a policy changes.
