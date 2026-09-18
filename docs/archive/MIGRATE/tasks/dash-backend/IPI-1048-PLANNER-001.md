# IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant

**File:** `IPI-1048-PLANNER-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes  
**READY TO PATCH LINEAR:** YES  
**Audit score:** 99/100 · A+

## 0. Faster / better — FIRST/default method

```text
current secure ipixai runtime
→ keep auth / org / thread / Memory / Postgres / CopilotKit unchanged
→ mine Lumina Production Planner behavior only
→ replace weather/demo product definition
→ register one canonical Production Planner instance
→ focused registry + prompt regressions
→ STREAM regression + authenticated planning smoke
```

Do not redesign the runtime, add tools, add HITL, or port the Lumina multi-agent/runtime stack.

## 1. Current V2 scope

Promote the current authenticated `default` Mastra agent from the starter weather/demo agent to the iPix Production Planner. This task owns product identity, instructions, and canonical registration only.

Current `ipixai/main` verified: `src/mastra/agents/index.ts` still exports `weatherAgent`; `src/mastra/index.ts` still registers `default: weatherAgent`.
## 2. Exact LuminaAI sources to inspect

Primary implementation:
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/index.ts

Primary tests:
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/index.test.ts

Discovery only:
- https://github.com/amoai-tech/luminaai/tree/main/app/src/mastra/agents

## 3. COPY

- Production Planner identity and fashion-production vocabulary
- safe uncertainty / ask-for-missing-input behavior
- recommendation-vs-saved-state language
- no-silent-write rules
- narrow tool-access principle
- relevant behavior/registry tests as oracles

## 4. ADAPT

- Keep current ipixai model/provider, Memory/Postgres, auth/org/thread identity, runner and AG-UI transport
- Export one canonical `productionPlannerAgent`
- If both `default` and `production-planner` registry keys exist, both must reference the exact same Agent object
## 5. DROP

- weatherAgent from production registry
- weatherTool from production Planner
- Lumina `mastraWorkflows("shoot-wizard")`
- old HITL/save tools
- old Cloudflare model routing/runtime/storage
- old multi-agent registry
- booking/CRM/assets/campaign tool access

## 6. Dependencies

Hard start gate: `IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely` must be certified Done. AUTH/org/thread/memory dependencies are satisfied and must be reused, not rebuilt.

## 7. Acceptance criteria

- [ ] STREAM-001 certified
- [ ] one canonical `productionPlannerAgent`
- [ ] `default` references the same Planner instance
- [ ] no production registry imports `weatherAgent`
- [ ] no weather tool attached to the production Planner
- [ ] current Memory/Postgres/auth/org/thread behavior unchanged
- [ ] Planner understands fashion-production planning
- [ ] missing facts trigger questions/explicit assumptions, not invention
- [ ] Planner never claims writes/approvals occurred
- [ ] no TOOL-001 tools added prematurely
- [ ] focused registry/instruction tests green
- [ ] typecheck + build + authenticated Planner smoke green

## 8. Verification

`static diff → focused agent/registry tests → STREAM regressions → typecheck → build → authenticated planning turn`

**Will task succeed? YES after STREAM-001 certification.**

## 9. READY TO PATCH LINEAR

**YES.** Prepend only the 2026-09-03 reuse/contract deltas; do not rewrite unrelated historical issue body.
