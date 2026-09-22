# CopilotKit in iPix

CopilotKit owns the **operator-facing interactive AI experience** in iPix: chat, AG-UI events, generative UI, shared interactive state, and human review surfaces. Mastra owns agents, tools, workflows, memory orchestration, and durable AI execution.

## Start here

| Need | Read |
| --- | --- |
| Overall runtime/UI boundary | [Architecture](./ARCHITECTURE.md) |
| Agent ↔ UI event protocol | [AG-UI](./AG-UI.md) |
| Human review and approval surfaces | [Human-in-the-loop](./HITL.md) |
| Known failures and recovery | [Troubleshooting](./TROUBLESHOOTING.md) |
| Smallest required foundation | [Core PRD](./copilotkit-core-prd.md) |
| Product-facing MVP | [MVP PRD](./copilotkit-mvp-prd.md) |
| Later capabilities | [Advanced PRD](./copilotkit-advanced-prd.md) |
| Proven patterns to reuse | [Reuse plan](./reuse.md) |
| Readiness evidence | [Progress](./progress.md) |

## iPix rule

Use CopilotKit for the interactive layer, not durable application truth. Consequential actions follow **AI proposes → human reviews → approved action executes → system records the result**.

Current code/runtime, installed package types, and tests override historical plans. Linear owns live task status and blockers.
