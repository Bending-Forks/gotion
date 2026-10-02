---
title: Design
nav_order: 3
---

The design turns the [Event Storming](analysis.html#event-storming) board into the model the
services implement, at the two levels DDD distinguishes. The strategic design starts from the
[subdomains](analysis.html#subdomains) found in the analysis, in the problem space, and settles
the bounded contexts and their relations. The tactical design works in the solution space: for each bounded
context it describes the aggregates, the rules they protect and the events they publish.

Every name below is a term of the [ubiquitous language](analysis.html#ubiquitous-language),
and every aggregate is one of the large yellow stickies of [step 9](analysis.html#9-aggregates).

{% include strategic-design.md %}

{% include tactical-design.md %}

{% include architecture.md %}

{% include microservices.md %}

{% include patterns.md %}
