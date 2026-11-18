---
name: service-contract
description: Write or change what a service shows to the others - its OpenAPI (client API and queries) or AsyncAPI (events) specification in `api/`, the consumer-driven contract examples in `api/contracts/<consumer>/`, the code generated from them, and the contract tests. Use it whenever a task touches a service's `api/` folder, or a request, response or event that crosses services.
---

# Service contracts

What a service shows to the others is its published language: shaped for its consumers and decoupled from its internal model, which can change freely behind it. The rules are in *Contracts* (`docs/_includes/microservices.md`) and ADR-08, the tests in *Contract tests* (`docs/implementation.md`).

## Writing or changing a specification

1. Find who reads it: the context map (`docs/_includes/strategic-design.md`) and the table of each service under *Services* in `microservices.md` say which consumer uses which query or event.
2. Write it in the provider's `api/`: OpenAPI for REST, the client API and the queries (the queries carry their version in the path); AsyncAPI for the events, with the envelope shared by every service. Schemas are JSON Schema. Follow the layout the other services already use.
3. Expose what the consumers need, in terms they understand, never the tables or classes of the provider.
4. Before changing a message that exists, classify the change:
   - **compatible**, the version stays: adding an optional field;
   - **breaking**, a new version published next to the old one until every consumer has moved: removing or renaming a field, changing its type or its meaning. The paths under `api/contracts/` name the consumers to agree it with.
5. Generate again the code that comes from the specification (the tools are in the tables of `docs/implementation.md`) and commit it. Never edit generated code by hand.

## Contract examples

- The consumer writes them, in the provider's `api/contracts/<consumer>/`: one JSON example per interaction, either an event as the consumer reads it or a request with the response it expects.
- An example holds only the fields the consumer reads, plus the envelope fields it needs to recognize a repeated event, and must validate against the provider's schema. A field the provider doesn't publish is asked for as an optional field, a compatible change, and only then added to the example.

## Contract tests

Each example is used twice:

- **Provider**: build the event in the scenario of the example, or replay the request on the handler in memory (`httptest` in Go, `fastify.inject` in Editing) with the application services stubbed. The result must validate against the schema and contain the example.
- **Consumer**: the event goes into the real Kafka adapter, or the example serves as a stub of the provider for the HTTP client. Check what the application service receives, translated when there is an anticorruption layer.

A provider test that fails means a breaking change: fix the specification, or change the consumer and its example in the same PR. Never edit a consumer's example just to make the provider pass.
