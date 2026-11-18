---
name: test-strategy
description: Decide which kind of test a change needs and where it runs - unit (sociable or solitary), integration against a real PostgreSQL or Kafka, contract, component, end-to-end - and how to test a quality attribute scenario. Use it when planning the tests of a feature, an adapter or a QA scenario, or when a test is slow, flaky or mocks too much.
---

# Test strategy

Superpowers' test-driven development says how to write a test first; this skill says which test to write.

## Pick the kind by what is under test

From many and fast to few and slow:

| Kind | Under test | Replaced | Runs |
|---|---|---|---|
| Unit, sociable | Root, entities, value objects | Nothing | Next to the code, on every pull request |
| Unit, solitary | Application services, inbound adapters (handlers, consumers), domain services | Their ports, with in-memory fakes | Next to the code, on every pull request |
| Integration | One adapter against the real infrastructure: a repository on PostgreSQL, a publisher or consumer on Kafka | Nothing on the infrastructure side | Against PostgreSQL or Kafka in a container, in the CI too |
| Contract | What crosses two services | The other side, by the consumer's example | See the `service-contract` skill |
| Component | One service as a black box, through its API | The other services, by stubs | Per service |
| End-to-end | A user journey across the whole system | Nothing | Against the whole system in Compose, few of them |

- The domain is never tested through mocks, and an adapter is never tested by mocking its library: that is what the integration test is for.
- An end-to-end test follows a whole user journey (create, rename and delete a workspace in one test), so there are few of them and each one covers much.

## Tests of a quality attribute scenario

- The response measure of the scenario (`docs/_includes/quality-attributes.md`) is the assertion. Write it down before the test.
- A scenario whose target is 100 % is an invariant, checked by a test rather than an SLO: the planned tests of QA-04, QA-05, QA-06 and QA-07 are listed in the comment under *Testing* in `docs/implementation.md`.
- A test that needs failures (a consumer stopped mid-cascade, a process killed under load) injects them on purpose, and checks the state after recovery.
- Randomized tests (property-based, random interleavings) print their seed, so a failure can be replayed.

## In the pipeline

- Fast tests run on every pull request; slower ones get their own job, so a failure says which kind broke. Each job is listed in the `needs` of `success`.
- Coverage only shows code no test runs; it says nothing about the code it marks as covered. Don't write tests to raise it.
