---
title: Mastra version migrations
description: Load when changing any Mastra package family, runtime API, or compatibility-sensitive integration.
parent: mastra
impact: HIGH
impactDescription: Prevents partial package upgrades, latest-doc drift, and false-green runtime migrations
tags: mastra, migration, upgrade, dependencies
---

# Mastra migration guide — iPix package-family rule

## Core rule

Do not upgrade Mastra by installing arbitrary `latest` packages or changing `@mastra/core` alone.

A Mastra migration is a compatibility change across the affected package family and integration boundary.

## Required sequence

```text
record current exact package family
→ identify the concrete reason to upgrade
→ identify smallest compatible target family
→ inspect mastraMigration / official migration notes
→ inspect installed source/types before change
→ update only the required compatible set
→ resolve compile/API changes
→ run risk-specific targeted proof
→ typecheck/build
→ exact runtime/journey proof when behavior changed
```

## 1. Record the current family

Capture `package.json`, lockfile, and installed versions for all affected packages, including as applicable:
- `@mastra/core`;
- `@mastra/memory`;
- `@mastra/pg` / storage packages;
- `@mastra/client-js`;
- `mastra` CLI;
- `@ag-ui/mastra`;
- CopilotKit packages that sit on the same runtime path.

Do not assume all `@mastra/*` packages share the same numeric version. Compatibility is proven by the installed/recommended family, not identical version strings.

## 2. Define the reason and target

State the concrete capability/bug/API that requires the migration. Prefer the smallest version/family that solves it.

Do not upgrade for "latest" alone when the current certified family already satisfies the product requirement.

## 3. Use official migration tooling as evidence, not authority over installed code

Use:
- Mastra docs MCP `mastraMigration`;
- official migration guides;
- release/changelog notes;
- official GitHub source/issues when behavior remains unclear.

If a codemod is recommended, verify its current official package/name/version before running it. Do not execute an unverified `@latest` codemod copied from this file or old documentation.

## 4. Verify exact APIs

Before and after the dependency change, inspect installed source/types for every load-bearing changed API, especially:
- Agent constructor/registry behavior;
- tool `execute` context/signature;
- Memory scope/storage APIs;
- PostgresStore construction/init behavior;
- RequestContext;
- workflow suspend/resume/snapshot APIs;
- streaming/abort behavior;
- CopilotKit/AG-UI adapter behavior.

Current remote docs explain current concepts. The installed target family defines what this repository can actually call.

## 5. Update the compatible set only

Use the repo package manager and preserve the lockfile. Review the lockfile delta for unexpected transitive changes.

Never use:

```text
npm update @mastra/core
```

as a generic fix.

Never install every Mastra package at `latest` without proving the family is intended and compatible.

## 6. Run proof classes affected by the migration

A clean typecheck is necessary but not sufficient.

Choose applicable proof classes:
- registry/config;
- deterministic tools;
- natural-language tool routing;
- tenant/context authority;
- memory/resource/thread scope;
- persistence/restart;
- HITL exact-artifact approval;
- workflow suspend/resume/recovery;
- Stop/abort propagation;
- side-effect idempotency;
- observability/evals;
- exact deployed runtime.

If the migration claims to fix a bug, reproduce the bug before upgrade when feasible and prove the exact scenario after upgrade.

## 7. Development/runtime commands

For iPix use the repository scripts. Run agent and UI development separately:

```text
npm run dev:agent
npm run dev:ui
```

Do not use combined `npm run dev` as the default migration proof.

Use the local pinned Mastra binary (`npx --no-install mastra ...`) rather than allowing `npx` to download a newer CLI implicitly.

## Supply-chain gate

For dependency-family changes verify:
- intended direct dependencies only;
- explainable lockfile scope;
- no unexpected package source/provenance;
- current security advisories where relevant;
- Node/runtime compatibility;
- build/deploy compatibility;
- rollback path to the previous lockfile/family.

## Storage migration gate

When storage behavior/schema changes:
- inspect official migration requirements;
- confirm current iPix `mastra` schema ownership;
- do not let runtime auto-init mutate hosted production unexpectedly;
- test on disposable/local/preview state first;
- prove existing messages/threads/workflow snapshots survive or document a deliberate incompatible migration.

## IPI-1460 lesson — migrate workflow journal before upgrading runtime

**Reference — ADAPT:** [exact iPix 1.84 compatibility migration](https://github.com/amoai-tech/ipixai/blob/0323a24f3c33c5e350bb4d87621ed10c88b55839/supabase/migrations/20261119000000_ipi1460_mastra_184_compat.sql), [production release](https://github.com/amoai-tech/ipixai/blob/0323a24f3c33c5e350bb4d87621ed10c88b55839/docs/production-release.md), [Mastra PostgreSQL](https://mastra.ai/integrations/databases/postgresql). The PG 1.37 workflow store reads legacy `mastra_workflow_snapshot` and `mastra_workflow_runs` / `mastra_workflow_run_entries`. Missing journal tables caused `resume_failed` even though unit and browser Planner tests passed; `disableInit: true` prohibits runtime auto-migration.

For a **future** upgrade: inspect exact installed PG adapter's read/list/resume SQL and required exporter schema; compare production state **read-only**, then add only needed tables/columns through approved migrations. Rehearse idempotent migration twice on disposable Postgres; prove RLS + FORCE RLS, runtime-only grants, existing snapshot preservation, fresh-instance real Shoot Plan and Brand Intelligence suspend → approval/reject → idempotent resume and Org B/revoked/stale denial. Do **not** reset/reapply production migrations, shift schema to `public`, or resume the 32 customer runs as QA.

Then stage a single exact build, log separately authorized paid test scope and actual spend if available, verify alias/SHA **after** QA, request human promotion approval and certify the exact promoted live artifact. Maintain the rollback candidate. **STOP** on `resume_failed`, missing journal table, missing grants, schema drift, unexpected alias changes or unapproved AI charges.

## Completion evidence

Record:
- old family;
- new family;
- migration guide/release evidence used;
- exact changed APIs;
- exact targeted tests;
- typecheck/build result;
- runtime/browser/restart/HITL/abort evidence as applicable;
- known retained workaround and why it is still needed, or proof it was removed;
- rollback command/commit.

## Source priority

```text
current repo + installed family
→ installed source/types
→ embedded docs when present
→ Mastra MCP/current official docs
→ migration guides/releases
→ official GitHub issues/source for unresolved behavior
```
