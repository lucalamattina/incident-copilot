# IncidentCopilot

An AI orientation assistant for the primary on-call engineer during the opening minutes of a production incident. It reads three sources (playbooks, deploys, logs), accelerates the information-gathering an engineer already does under stress, and recommends, but it never acts. Built against a fictional PaaS with fictional, deterministic fixtures.

## What it does

The copilot serves two kinds of request, routed implicitly by a single agent:

- **Investigation (agentic).** When the engineer does not yet know what is wrong, the agent branches over deploys and logs, letting each tool result decide the next call: a suspicious deploy leads to its service's logs, a log spike leads to recent deploys on that service or its dependencies. The investigation path is not knowable in advance, which is what warrants an agent over a fixed pipeline.
- **Retrieval (RAG).** When the engineer has diagnosed the issue, a retrieval-augmented pipeline over the playbook corpus returns the matching playbook. Chunk-level semantic search for precision, returning the whole parent document for completeness.

Two read paradigms in one system, each matched to its problem shape.

### Design principles

- **Zero-write trust boundary.** The copilot has no write capability of any kind. It reads and recommends; every action that touches a system is taken by the human. There are simply no write tools.
- **Deterministic fixtures.** Everything is anchored to a fixed fictional "now"; nothing reads the wall clock, which keeps the fixtures and the evaluation reproducible.

## Stack

- TypeScript on Node (20+)
- Anthropic SDK directly: `claude-sonnet-4-6` as the agent, `claude-opus-4-8` as the evaluation judge
- Postgres with pgvector, backing both the deploy/log fixtures and the playbook index
- Kysely for typed database access
- Local fastembed embeddings (`bge-small-en-v1.5`, 384 dims; no embeddings API key required)

## Prerequisites

- Node 20 or newer
- Docker (for the local Postgres + pgvector instance)
- An Anthropic API key (only for the chat CLI and the evals; not needed to build or run the deterministic tests)

## Setup

```sh
cp .env.example .env       # set ANTHROPIC_API_KEY for chat/evals; DATABASE_URL points at the local db
npm install
npm run db:up              # start Postgres + pgvector, wait for healthy
npm run seed               # migrate + load the deploy/log fixtures
npm run ingest             # chunk, embed, and index the playbook corpus
```

The first embedding run downloads the local model once, then runs offline.

## Using the copilot

```sh
npm run chat
```

A multi-turn console over the seeded data. For example, "auth-service is throwing token validation failures and users are getting logged out, what is going on?" will branch across services to investigate. The copilot only ever recommends; it frames remediation as steps for you to take.

## Evaluation

Evaluation is tiered to match how knowable the correct output is. See [EVALUATION-FINDINGS.md](EVALUATION-FINDINGS.md) for results, including a grounding failure the harness caught and the before/after of the fix.

```sh
npm run eval:tier1            # exact assertions: golden set of single-intent prompts
npm run eval:tier2            # property pass-rates over N samples (TIER2_SAMPLES, default 5)
npm run eval:tier2:verdicts   # a single per-property verdict per case (with rationales)
npm run eval:tier2:calibrate  # judge-vs-human agreement on hand-labelled samples
npm run eval:tier3            # authored scenarios: did it reach the right conclusion (TIER3_SAMPLES, default 5)
```

- **Tier 1** asserts on the recorded tool-call trace: arguments for the structured tools, top result for retrieval.
- **Tier 2** checks termination and coverage programmatically, and grounding / trust-boundary / conclusion-supported via the Opus judge over the run's own retrieved data, reported as pass-rates because the agent is non-deterministic.
- **Tier 3** authors scenarios with one demonstrably-correct cause, then grades whether the agent reached it (a correctness judge given the answer) and whether it investigated enough (a programmatic sufficiency check).

The judge is part of the evaluation path only. The live copilot never calls it.

## Testing

```sh
npm test            # full suite
npm run typecheck   # type-check without emitting
```

Most tests are deterministic and run with no API key (assertion logic on synthetic traces, loop mechanics with a fake model client, tool/retrieval integration against the local database). A handful of tests are gated on `ANTHROPIC_API_KEY` and exercise the real model (the multi-hop branching test, the judge discrimination tests); they skip cleanly when no key is set.

## Project structure

```
src/
  domain/      types, the closed service set, zod schemas, the fixed NOW clock
  db/          Kysely client, migrations, repositories
  fixtures/    deploy and log fixtures (incl. a planted multi-hop scenario), seed
  tools/       the three read-only tools (query_deploys, query_logs, search_playbooks)
  rag/         playbook loader, chunker, embeddings, ingest, retrieval
  agent/       the agent loop, system prompt, model ids
  cli/         the chat REPL
  eval/        tierOne, tierTwo (properties, judge, sampling, calibration), tierThree
  playbooks/   the markdown playbook corpus
docs/adr/      architecture decision records
```

## Design

The full design, including the goals, the two-mode architecture, the evaluation strategy, and the deliberate tradeoffs, is in [DESIGN.md](DESIGN.md). Key architecture decisions are also recorded as standalone ADRs in [docs/adr/](docs/adr/): RAG for playbook retrieval, implicit routing, the zero-write trust boundary, and building on the Anthropic SDK without an agent framework.
