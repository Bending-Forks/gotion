---
title: Implementation
nav_order: 4
---

## Microservices

## Testing

<!-- TODO SLO: the scenarios whose target is 100 % are invariants, verified by tests and not
by an SLO: QA-04 zero loss of acknowledged edits (chaos test: kill the process under load,
then check every acknowledged edit after the restart), QA-05 convergence (property-based
test over 1 000 randomized interleavings), QA-06 (authorization matrix per role and
operation; for a non-member, "forbidden" and "non-existent" responses compared byte by byte),
QA-07 (after 5 failed logins the 6th attempt gets 429). -->

## Multiplatform

## Experiments

## Monitoring

<!-- TODO SLO: the SLOs are the response measures of the runtime scenarios, measured over 30
days: QA-01, QA-02, QA-03 and the recovery within 60 s of QA-04. For each one: the SLI as good
events over valid events, the target, the error budget, the metric and its PromQL query, the
Grafana dashboard and the alert (steps 4 and 5 of the lab notes "Quality Attributes in SRE").
The local render of QA-01 and the remote render of QA-02 are measured in the client, and
QA-02 corrects for the offset between the client and server clocks. Say also why the other
scenarios have no SLO: they are invariants (see Testing) or development time attributes (see
CI/CD in DevOps). -->
