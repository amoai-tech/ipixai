# CopilotKit 1.88 Inspector and debug logging (React v2)

Use `CopilotKit` from `@copilotkit/react-core/v2`. These controls are
independent:

- `enableInspector?: boolean` controls the development-only Inspector overlay.
  Set `false` to hide it on localhost. Omitted or explicitly `true`
  may show the Inspector only during development on loopback hosts
  (`localhost`, `127.0.0.1`, or `[::1]`); it never loads
  during SSR, in production builds or on remote React hosts.
- `debug` controls diagnostic console logging. Avoid logging real customer
  messages, tenant data, credentials or tool arguments in shared environments.

The iPix Production Copilot intentionally disables the Inspector:

```tsx
"use client";
import { CopilotKit } from "@copilotkit/react-core/v2";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" enableInspector={false}>
      {children}
    </CopilotKit>
  );
}
```

For temporary local debugging, opt in with `enableInspector={true}`
on a loopback development host. Never rely on a provider prop to override
the production/SSR/remote-host guards.

Do **not** use the legacy `showDevConsole` prop to control the
Inspector; it has no effect on CopilotKit 1.88 Inspector visibility.
Avoid copying old `"auto"` and `inspectorDefaultAnchor`
recipes into this app without checking the current installed API.

## Debug logging — separate from Inspector visibility

CopilotKit 1.88 accepts \`debug: true | false | DebugConfig\` in its provider
and runtime. The supported \`DebugConfig\` fields are:

| Field | Purpose |
| --- | --- |
| \`events\` | Log emitted/received AG-UI event summaries |
| \`lifecycle\` | Log run start, completion and failure summaries |
| \`verbose\` | Include **full payloads**, potentially exposing messages, tool arguments and tenant data |

\`debug={true}\` enables \`events\` and \`lifecycle\`, but does **not**
enable \`verbose\`. For a **local synthetic-data repro only**, use:

\`\`\`tsx
<CopilotKit
  runtimeUrl="/api/copilotkit"
  enableInspector={false}
  debug={{ events: true, lifecycle: true, verbose: false }}
>
  {children}
</CopilotKit>
\`\`\`

Do not enable verbose logging for customer data or leave this debug
configuration on in production. If a deeper local repro truly needs full
payloads, \`verbose: true\` is an explicit opt-in; sanitize evidence before
sharing. The provider's debug switch and server-side \`CopilotRuntime\`
debug switch are independent. Use \`events\`, \`lifecycle\` and \`verbose\` —
not unrecognized fields such as \`network\` or \`errors\`.

**Reference — REFERENCE ONLY:** https://docs.copilotkit.ai/troubleshooting/debug-mode
→ \`Granular Configuration\` / \`Defaults\`. Keep the existing
\`src/components/operator-panel/operator-panel.tsx\` provider unchanged;
verify installed 1.88 types and \`operator-panel.test.tsx\`, and use
synthetic local data to confirm logging remains off in normal operation.

**Reference — REFERENCE ONLY**

- URL: https://docs.copilotkit.ai/troubleshooting/inspector-dev-console
- Source: React v2, Inspector visibility and production/host safeguards
- Use: `enableInspector={false}` on the existing iPix provider
- Do not copy: legacy v1 console behavior or unrelated providers
- Apply to: `src/components/operator-panel/operator-panel.tsx`
- Verify: `operator-panel.test.tsx` asserts Inspector is disabled and
  the obsolete option is absent; on localhost, no floating Inspector is shown
