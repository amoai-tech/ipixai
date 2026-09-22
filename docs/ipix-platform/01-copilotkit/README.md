# CopilotKit in iPix

CopilotKit owns the **operator-facing interactive AI layer**: runtime transport, chat/agent interaction, AG-UI-compatible streaming, and UI actions. Durable application truth remains in Supabase/Postgres, while Mastra owns agents, tools, workflows, and durable AI execution.

## Current verified implementation

- Installed package family: `@copilotkit/react-core@1.68.1` and `@copilotkit/runtime@1.68.1`.
- Runtime endpoint: `src/app/api/copilotkit/[[...slug]]/route.ts`.
- Request authentication helpers: `src/lib/auth/copilot-hooks.ts` and `src/lib/auth/copilot-mount.ts`.
- Reconnect/history behavior has targeted coverage in `src/components/operator-panel/copilotkit-reconnect-history.test.tsx`.
- Consequential writes must follow **AI proposes → human reviews → server revalidates → authorized action executes → system records the result**.

## Source of truth

Current code, installed package types, tests, and accepted architecture decisions override historical CopilotKit plans. Linear owns live task status and blockers.

## References

- [CopilotKit documentation](https://docs.copilotkit.ai/)
- [CopilotKit GitHub repository](https://github.com/CopilotKit/CopilotKit)
- [AG-UI protocol](https://docs.ag-ui.com/)
