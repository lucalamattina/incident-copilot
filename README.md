# IncidentCopilot

An AI orientation assistant for the on-call engineer in the opening minutes of a production incident. Read-only over three sources (playbooks, deploys, logs), it accelerates information-gathering and recommends, but never acts.

Built against a fictional PaaS with fictional fixtures. See the design docs (`CONTEXT.md`, `GLOSSARY.md`, `implementation.md`) for the full design, ubiquitous language, and phased plan. Architecture decisions are recorded in `docs/adr/`.

## Stack

- TypeScript on Node (20+)
- Anthropic SDK (Claude Sonnet as the agent, Claude Opus as the Tier-two judge)
- Postgres with pgvector, backing both the deploy/log fixtures and the playbook index
- Kysely for typed database access
- Local fastembed embeddings (no embeddings API key required)

## Prerequisites

- Node 20 or newer
- Docker (for the local Postgres + pgvector instance)

## Setup

```sh
cp .env.example .env      # adjust if your local Postgres differs
npm install
npm run db:up             # start Postgres + pgvector, wait for healthy
npm test                  # run the suite
```

The first test run may download the local embedding model once; after that it runs offline. No Anthropic API key is needed until M6.

## Scripts

- `npm run db:up` / `npm run db:down` — start/stop the local database
- `npm test` / `npm run test:watch` — run the test suite
- `npm run typecheck` — type-check without emitting
