# 05 — Starter decision (`integrations/mastra`)

**After:** [04-example-catalog.md](../../notes/04-example-catalog.md)
**Before:** [06-example-adoption.md](./06-example-adoption.md)

Canonical write-up: [01-repo-review.md](../../notes/01-repo-review.md) · tasks: [02-repo-to-task-map.md](../../notes/02-repo-to-task-map.md)

## Use

- Foundation: [examples/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra)
- APIs: [v2/runtime](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/runtime) (`node`) · [v2/react](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react)
- Shared state: [canvas/mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm)
- Canvas: [canvas/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra)
- GenUI: [showcases/generative-ui](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui)
- Mastra memory/tasks: [template-agent-harness](https://github.com/mastra-ai/template-agent-harness)
- ADV coworker: [OpenBot](https://github.com/CopilotKit/OpenBot)

## Do not copy into v2

All [examples/v1/*](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v1) and [v2/react-router](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react-router).
Yes. After the deeper code review, I would use **`examples/integrations/mastra` as the starter**.

The strongest reason is not just that it is labeled a starter. It is also on the **much newer runtime stack**: CopilotKit `1.68.1`, `@ag-ui/mastra` `1.1.2`, Next `16.1.2`, React `19.2.1`, and current `/v2` runtime imports.

By comparison, `canvas/mastra-pm` is still extremely useful, but it is on an older stack: CopilotKit `1.10.3`, `@ag-ui/mastra` `0.0.10`, Mastra core `0.16.0`, and older AI SDK packages.

## Verdict

| Repo                               | Role for new iPix                                                 |             Score |
| ---------------------------------- | ----------------------------------------------------------------- | ----------------: |
| **`examples/integrations/mastra`** | **STARTER / FOUNDATION**                                          |        **97/100** |
| `examples/canvas/mastra-pm`        | **Feature reference: shared state + working memory + Planner UX** |        **92/100** |
| `examples/canvas/mastra`           | **Feature reference: canvas/cards/planning UI**                   |        **87/100** |
| `/examples/canvas` root            | Reference collection only                                         | **Not a starter** |

The `canvas` directory is actually a collection of implementations using Gemini, LangGraph, LlamaIndex, Pydantic AI, Mastra, and Mastra PM. It is therefore a **pattern library**, not an architectural foundation.

# Why `integrations/mastra` wins

It has exactly the architecture we want:

```text
Next.js App Router
        ↓
CopilotKit v2
        ↓
AG-UI
        ↓
local Mastra agents
```

Its source is cleanly divided into `app`, `components`, `lib`, and `mastra`, and it explicitly discovers local Mastra agents through `MastraAgent.getLocalAgents({ mastra })`.

That matches the direction we want for iPix:

```text
Next.js
  ├── existing iPix pages
  ├── existing OperatorShell
  └── CopilotKit UI
          ↓
      AG-UI
          ↓
        Mastra
          ↓
       Supabase
```

# Important finding: don't blindly clone it either

There is one important detail from the deeper review.

The current starter route uses:

```text
createCopilotEndpoint
Hono/Vercel handle()
InMemoryAgentRunner
optional CopilotKit Intelligence
demo-user identity
```

Its own comment explicitly warns that the demo user must be replaced before multi-user deployment because otherwise users would share thread history.

So for iPix:

### Copy

```text
Next.js project structure
CopilotKit v2 package family
Mastra local-agent model
AG-UI wiring
runtime endpoint pattern
provider/frontend integration
```

### Replace immediately

```text
demo-user
      ↓
Supabase authenticated user

InMemoryAgentRunner
      ↓
Mastra PostgresStore + explicit threadId

demo agent
      ↓
iPix Production Planner

demo storage
      ↓
existing Supabase mastra schema

generic authorization
      ↓
iPix organization/thread isolation
```

That gives us the good architecture without importing demo assumptions.

---

# Where `mastra-pm` becomes valuable

This repo is actually closer to **how the iPix product should feel**, even though it should not be the underlying starter.

Its structure includes:

```text
app
cli
lib
mastra
```

and was designed around the collaborative project-management/canvas use case.

For iPix, borrow the concepts:

```text
mastra-pm
tasks[]
team[]
status[]
```

and map them to:

```text
iPix
shoots[]
fittings[]
crew[]
talent[]
deliverables[]
approvals[]
budget[]
```

### Example

Operator says:

> Move Sofia's fitting to Tuesday.

The right experience is:

```text
Production Planner
       ↓
updates shared state
       ↓
Planner board updates instantly
       ↓
approval card appears if persistent data changes
       ↓
operator approves
       ↓
Supabase write
```

That is where `mastra-pm` is more useful than the starter.

So think of them like:

```text
integrations/mastra
        =
ENGINE + CHASSIS

mastra-pm
        =
DASHBOARD / INTERACTION IDEAS
```

---

# And `canvas/mastra`?

Use it after `mastra-pm` for rich visual artifacts.

Good use cases:

```text
Shoot plan card
Creative concept card
Talent shortlist
Production package
Moodboard
Campaign plan
Approval artifact
```

It belongs in **MVP feature development**, not Core architecture.

---

# Recommended construction

Don't merge the repositories.

Build this way:

```text
STEP 1
Clone/adapt integrations/mastra
        ↓
clean current runtime

STEP 2
Supabase Auth
        ↓
organization isolation

STEP 3
Mastra PostgresStore
        ↓
persistent Planner thread

STEP 4
TEST-123 golden test
        ↓
refresh/restart/isolation

STEP 5
bring existing iPix shell/pages
        ↓
Operator UI

STEP 6
borrow shared-state patterns
from mastra-pm

STEP 7
borrow cards/canvas
from canvas/mastra

STEP 8
add generative UI/HITL
```

## The final iPix starter recipe

```text
BASE
CopilotKit integrations/mastra
             │
             ├── update auth → Supabase
             ├── update persistence → PostgresStore
             ├── update agent → Production Planner
             └── add org isolation
                       │
                       ▼
                GOLDEN TEST
                       │
       ┌───────────────┴──────────────┐
       ▼                              ▼
existing iPix UI                mastra-pm ideas
shell/pages                     shared state
       │                              │
       └───────────────┬──────────────┘
                       ▼
                 canvas/mastra
                 cards/artifacts
                       │
                       ▼
                Generative UI/HITL
```

# One correction to our earlier plan

Previously I gave `integrations/mastra` about **98/100** as the starter.

After examining the current source, I'd make it **97/100**, because its route still contains demo-oriented choices such as `InMemoryAgentRunner`, optional Intelligence setup, `demo-user`, and Hono/Vercel wrapping.

Those are easy to replace, though.

`mastra-pm`, meanwhile, falls from a possible starter candidate to roughly **75/100 as a starter**, mainly because its actual dependency family is substantially older. As a **feature/reference repo**, it remains about **92–95/100**.

## Final decision

**Use:**

> **CopilotKit `examples/integrations/mastra` as the new iPix starter.**

Then selectively import ideas—not packages or old runtime code—from:

> **`canvas/mastra-pm` for shared state / Planner UX**

and:

> **`canvas/mastra` for visual cards/canvas/artifacts.**

That is the fastest and lowest-risk path because we get the **newest plumbing from one source** while taking the **best product UX ideas from the Canvas examples**, rather than trying to upgrade an older Canvas application into our production foundation.
