---
title: Advanced Mastra runtime capabilities
description: Load when evaluating Code Mode, Dynamic Workflows, Channels, or Pub/Sub for iPix.
parent: mastra
impact: MEDIUM
---

# Advanced runtime capabilities

**Historical feature inventory:** researched on Core 1.71.0, not certified on the current 1.84.0 family. Verify installed source/types and [current runtime](../../../../docs/mastra/runtime-family.md) before adopting optional capabilities; none are enabled by this document.

| Capability | Installed doc | iPix fit |
| --- | --- | --- |
| Code Mode | `docs-agents-code-mode.md` | Useful for multi-tool analytical/computational questions; optional, sandbox required |
| Dynamic Workflows | `docs-workflows-dynamic-workflows.md` | Advanced: user/agent-created workflow definitions; never allow consequential writes without approval/governance |
| Channels | `docs-channels.md` | Optional Slack/Teams/WhatsApp/etc delivery surface; application truth stays in Supabase |
| Pub/Sub | `docs-server-pubsub.md` | Useful when processes/services must exchange durable runtime events; not needed for ordinary request/response flows |

## iPix decision rule

Prefer the simplest primitive first: ordinary tool calls → fixed workflow → these advanced capabilities only when the observable product requirement justifies them.

Code Mode must run in an appropriately isolated sandbox. Dynamic Workflow definitions are data and must be validated, authorized, versioned, and human-approved before they can produce consequential domain writes.
