---
title: DevOps
nav_order: 5
---

## Project Structure

## VCS & Repo

## Quality Assurance

## CI/CD

<!-- TODO SLO: the development time scenarios become gates in the pipeline: QA-08 (a
fresh-install job on a clean runner: one documented command, reachable within 600 s, no
manual database step), QA-09 (an architecture test: real-time synchronization and
persistence do not depend on any block type), QA-10 (axe-core with 0 WCAG 2.1 AA violations,
and a keyboard-only e2e test for every block operation). -->

## Deployment

<!-- TODO SLO: Gotion is self-hosted, so the running instance is the customer's: the
monitoring stack (Prometheus, and Grafana with the SLO dashboards and alerts) is part of the
deployment, started by the same documented command of QA-08. -->

## Benchmark

<!-- TODO SLO: before a release, run the runtime scenarios as tests on the reference
deployment (4 vCPU, 8 GB RAM, 50 members, 10 000 pages, 1 000 000 blocks): QA-01, QA-02 with
5 concurrent editors, QA-03 with a cold cache, QA-04 recovery after a crash. The benchmark
checks each scenario in one run; Monitoring checks the SLO over time on a running instance. -->
