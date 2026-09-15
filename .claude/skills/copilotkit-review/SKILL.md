---
name: copilotkit-review
description: >
  Review iPix CopilotKit v2 and AG-UI changes for material runtime, tenant, thread,
  transport, HITL, and Mastra integration regressions. Use only for PR review;
  verify installed source/types before making API claims.
metadata:
  version: "1.0.0-ipix.1"
  owner: IPI-1213
---

# CopilotKit PR Review

## Source-of-truth order

```text
changed iPix code + tests
→ installed package source/types
→ current official CopilotKit docs/source
→ iPix developer skill/reference text
```

CopilotKit APIs move. Do not block a PR from memory or stale copied API detail.
A finding is material only when changed code violates a verified current invariant
and has a realistic runtime, security, data, CI, or operator failure scenario.
## iPix review invariants

1. **Stay on CopilotKit v2.** iPix imports `@copilotkit/runtime/v2` and
   `@copilotkit/react-core/v2`. Treat package-root imports as a compatibility
   regression unless the PR proves an intentional supported migration.
2. **Preserve the runtime/transport contract.** The authenticated
   `/api/copilotkit` route owns `CopilotRuntime`, AG-UI agents, runner behavior,
   and endpoint wiring. A frontend transport change must stay compatible with
   that route; do not infer compatibility from types alone.
3. **Preserve agent identity.** `agentId="default"` must resolve to a registered
   local Mastra agent. Flag changed code that can make the UI target a missing or
   differently named agent without a coordinated registry/runtime change.
4. **Preserve tenant-scoped thread/run behavior.** Thread, connect, stop, and
   runner state must not allow one org/user to observe or cancel another org's
   run. Browser-supplied IDs are not authorization.
5. **Verify runner-mode compatibility.** Before flagging Intelligence/local
   runner changes, inspect the installed `@copilotkit/runtime` implementation;
   do not invent restrictions from old docs.
6. **Preserve AG-UI/Mastra compatibility.** When agent cloning, abort/stop,
   streaming, interrupts, or HITL behavior changes, inspect both installed
   CopilotKit and `@ag-ui/mastra` source/types and require a concrete failure.
## Review discipline

- Prefer the smallest proven fix and existing iPix ownership boundaries.
- Do not report style-only findings or generic "verify the docs" advice.
- For v2 import findings, point to the changed import and require restoring the
  `/v2` surface plus the cheapest decisive typecheck/runtime test.
- For tenant/thread findings, state the smallest Org A → Org B failure sequence
  and require deterministic cross-org denial proof.
- Treat deterministic tests/CI as authoritative when AI review disagrees.
- Do not propose autonomous writes, publishing, payments, merges, or patches.

## High-value verification paths

Use existing repository commands when applicable:

```text
CopilotKit route/runtime change → targeted tests under src/app/api/copilotkit
React provider/chat change      → targeted component tests
shared runtime contract change  → targeted tests + npm run typecheck
high-risk cross-system change   → exact-head CI after targeted proof
```

Do not require broad suites when a cheaper proof fully establishes the invariant.
