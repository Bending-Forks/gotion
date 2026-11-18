---
name: domain-event
description: Add or change a domain event between services, or a policy that reacts to one - its name and content, its publication (outbox or direct), the idempotent consumer, the anticorruption layer, the cascades. Use it for tasks on Kafka producers and consumers, on the policies of "Rules across aggregates", and on the publisher, consumer router and outbox of the Go chassis.
---

# Domain events

An event is a fact of the producer's domain that other contexts react to. Between services it is part of the producer's contract: its specification follows the `service-contract` skill.

## Designing the event

- Start from the report: the event is in the command table of its aggregate (`docs/_includes/tactical-design.md`), the reactions in *Rules across aggregates*. An event that isn't there is a change of the model: add it to the report in the same PR.
- The name is a fact in the past tense, in the terms of the glossary (`WorkspaceCreated`, `MemberRemoved`). A command is imperative and is never published as an event.
- The content is the shared envelope plus a body that tells the whole fact: the identities and values the consumers need, so they don't have to call the producer back, never an object of the producer's model (*Contracts* in `docs/_includes/microservices.md`).
- The Kafka key is the identity of the aggregate, so the events of one aggregate are read in order.

## Publishing

- The aggregate returns the event, and the application service hands it to the publisher port.
- Account, Membership and Discussion write it into the outbox of the chassis, in the transaction of the command, never straight to Kafka (ADR-05).
- Editing publishes directly, once the operation is stored and applied. Its possible loss is a limit ADR-05 accepts for Page Deleted and Block Deleted only: extending direct publication to another event needs a decision.
- Notification publishes nothing.

## Consuming

- One handler per event, calling one application service: the policy changes one aggregate of the consumer.
- Kafka delivers at least once, so every consumer is idempotent: it records the identifier of the event in the same transaction as the change and skips one it has already applied, and it commits the offset only once the change is stored. The router of the Go chassis does this; Editing's consumer must do the same. A change that is idempotent by nature, such as deleting what is already gone, is still welcome.
- When the consumer's model differs from the producer's, an anticorruption layer in the adapter translates the event into the consumer's terms, as Editing turns a role of Membership into "may read" or "may also change". The domain never sees the producer's types: the generated ones stay in the adapter.
- Between the event and the reaction the rule doesn't hold yet: read models and commands must allow for it.

## Cascades

A chain of policies is a choreography with no coordinator (*Event delivery* in `docs/_includes/patterns.md`). It needs no saga only while no step can be refused by a rule of its context. A new policy that can be refused needs compensations: raise it as a design decision before writing code.

## Tests

- **Producer**: the test of the aggregate checks the event the command returns, the test of the application service that it reaches the publisher, the contract test the message on the wire.
- **Consumer**: the example of `api/contracts/<consumer>/` goes into the real Kafka adapter, and the test checks what the application service receives; delivering the same event twice changes the state once.
