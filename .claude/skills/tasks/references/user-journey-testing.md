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

## Current iPix testing layers

```text
Vitest → pure logic/components
Supabase SQL / existing fixtures → RLS/RPC/migrations/tenant contracts
Playwright → deterministic user journeys
Mastra/CopilotKit deterministic tests → agent/tool/workflow/runtime contracts
Explorbot → selected autonomous exploratory-browser pilot
GitHub Actions → exact-head merge enforcement
```

Explorbot supplements deterministic coverage; it is not yet a mandatory merge gate. A clean checkout must still be certifiable with repository-owned deterministic tests. Convert verified Explorbot discoveries into permanent regression tests when practical.

No other AI-evaluation or guardrail platform is adopted by this standard. Choosing one requires a separate explicit research/adoption decision with version, setup, secrets, commands, evidence format, ownership, and local/CI execution defined before it becomes a required gate.

## AI-native evaluation requirement

For AI-native workflows, verify the relevant behavior using the current iPix test/runtime stack: relevance/completeness, faithfulness/hallucination risk, tool selection/arguments, excessive agency, prompt-injection handling, sensitive-data/system-prompt leakage, HITL bypass attempts, rejection paths, and no durable write before approval. Prefer deterministic assertions and recorded tool/workflow outputs where they can prove the contract.

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
5. For AI-native journeys, evaluate relevance, faithfulness, tool correctness, guardrails, and HITL behavior with the current iPix test/runtime stack; do not introduce a new evaluation platform unless a separately approved task owns that decision.
6. Use Explorbot only after deterministic coverage exists, treat it as exploratory developer QA rather than a mandatory merge gate, and convert verified discoveries into permanent regression tests.
7. Do not certify the journey because one page renders or one Playwright script passes.
8. Record exact evidence for both system correctness and AI correctness.
9. Stop and update the task if the journey exposes an incorrect architecture, missing ownership boundary, unsafe write, tenant leak, or unowned failure path.
```
