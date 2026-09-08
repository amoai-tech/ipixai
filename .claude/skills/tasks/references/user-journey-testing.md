# User-journey testing standard

A user journey is not “does this page work?” It is whether the operator can achieve the real business outcome across every system the journey touches.

Prioritize a small number of business-critical journeys over broad low-value coverage.

For each journey define:
- actor + starting state
- business goal
- observable outcome
- systems crossed
- durable writes
- approval / HITL boundary
- happy path
- negative / recovery paths
- tenant/security boundaries
- completion evidence

## iPix testing layers

```text
Vitest → pure logic/components
Supabase SQL → RLS/RPC/migrations/tenant contracts
Playwright → deterministic user journeys
Explorbot → autonomous exploratory browser testing
DeepEval → relevance/faithfulness/tool/trajectory evaluation
Promptfoo or DeepTeam → injection/PII/excessive-agency/guardrails
GitHub Actions → exact-head merge enforcement
```

## Required journey scenarios

Test, when applicable:
- happy path
- empty/new state
- validation failure
- network/provider failure
- partial failure
- retry/recovery
- duplicate/idempotent action
- cross-tenant access
- unauthorized action
- stale data
- large-data/pagination
- mobile/responsive
- refresh/back navigation

For AI-native journeys also test:
- relevance and completeness
- faithfulness / hallucination
- tool selection + tool arguments
- unsafe/excessive agency
- prompt injection
- PII/system-prompt leakage
- HITL bypass attempts
- rejection path
- no durable write before approval

## Canonical iPix journeys

**Brand Intelligence**
```text
Brand URL → AI research → draft Brand DNA → operator review → approval → approved Brand Brain persisted
```
Negative: crawl failure, weak evidence, hallucination, duplicate brand, cross-tenant access, rejection, AI self-approval attempt.

**Production Planning**
```text
Brand → campaign brief → Planner → structured shoot plan → operator edit → approval → Shoot saved
```
Prove UI, CopilotKit, Mastra, tools, Supabase, authorization, HITL, and persistence.

**Assets**
```text
Shoot → upload → Cloudinary → asset metadata → DNA analysis → human approval → product linking
```
Negative: provider upload succeeds / DB fails, duplicate webhook, wrong org, transformation failure, wrong shoot linkage.

## AI-native certification rule

A green Playwright journey alone does not certify an AI-native workflow.
Certify both:
1. system correctness — navigation, auth/tenant, persistence, integrations;
2. AI correctness — relevance, faithfulness, tool correctness, guardrails, HITL.

## Agent prompt

```text
Identify the smallest set of business-critical user journeys affected by this task.

For each journey:
1. Define actor, starting state, business goal, observable success, systems crossed, durable writes, and approval boundaries.
2. Build realistic standard, empty, and large-data scenarios when applicable.
3. Define happy, negative, recovery, tenant/security, and edge paths.
4. Use deterministic tests first: Vitest / SQL / Playwright.
5. For AI-native journeys also evaluate relevance, faithfulness, tool correctness, guardrails, and HITL behavior using DeepEval/Ragas and Promptfoo/DeepTeam when applicable.
6. Use exploratory browser testing such as Explorbot only after deterministic coverage exists, and convert real discoveries into permanent regression tests.
7. Do not certify the journey because one page renders or one Playwright script passes.
8. Record exact evidence for both system correctness and AI correctness.
9. Stop and update the task if the journey exposes an incorrect architecture, missing ownership boundary, unsafe write, tenant leak, or unowned failure path.
```
