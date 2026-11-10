# iPix — Product Intent (WHY)

> **Purpose:** A short, durable explanation of the customer problem, product promise, and decision principles. This is **not** a replacement for the [master PRD](./prd.md), a feature status report, or a new task tracker.
>
> **Read with:** [Product specification](./spec.md) → [Delivery plan](./plan.md). For actual work, begin with the [live Linear issue](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues), [AGENTS.md](../AGENTS.md), and current code.

## One-sentence mission

Give fashion brands and production teams one **AI-native operating workspace** that turns approved brand intelligence into campaigns, shoots, assets, distribution, measurement, and learning — while **people keep creative and commercial control**.

`Brand → intelligence → campaign / shoot planning → approval → production → assets → commerce / publishing → analytics → learning`

This is the *intended end-to-end journey*, not a claim that every stage is already built. See the [durable roadmap](./roadmap.md) and [live V2 milestones](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues).

## The real problem

Fashion production often relies on spreadsheets, chat, email, disconnected creative tools, bookings, file links, and reports. A team repeatedly re-enters the same brand requirements, loses the rationale behind decisions, and cannot easily trace which asset was approved for which channel.

**A successful iPix experience:** One operator can understand the brand, make a defensible plan, get the right approval, coordinate production, deliver the right media, and later learn from verified outcomes without copying data between disconnected systems.

## Who is it for?

| Person | What they need | Concrete example |
|---|---|---|
| Brand owner / executive | Control over brand direction, budgets, and final business decisions | Review proposed campaign direction before authorizing publication |
| Creative director | Trusted Brand DNA and creative consistency | Compare a shot list with approved brand references |
| Producer / production operator | A dependable plan, progress, people, and assets | Turn a brief into a reviewable shoot, then track readiness and delivery |
| Sales / relationships team | Brand, contact, and production context | Connect an opportunity to the correct brand and production workflow |
| Talent / collaborators | Only their authorized tasks and information | Receive a relevant booking request without seeing unrelated brand data |

Roles and release scope remain defined by the [PRD](./prd.md) and current [Linear tasks](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues); this table does not grant permissions.

## North-star user journey

1. **Enter safely:** A real user signs in and reaches the correct organization's workspace.
2. **Understand the brand:** Bring in a brand URL or explicit inputs; review sources and an editable Brand DNA draft.
3. **Plan:** Ask Production Copilot for an evidence-aware shoot or campaign proposal; edit the result.
4. **Approve:** A human reviews the **exact version** and authorizes a specific consequential action.
5. **Produce:** Coordinate shoot, people, schedules, deliverables, and assets using durable records.
6. **Deliver:** Inspect and approve the exact media version before channel use.
7. **Publish and sell (when delivered):** Hand off explicitly approved content to the appropriate provider; preserve provider ownership of publishing and commerce truth.
8. **Measure and improve (later milestones):** Use real channel, media, product, and commerce results to propose reviewed Brand Brain improvements.

**Example:** A small clothing brand enters a new collection brief. iPix proposes three campaign ideas and a shoot plan. The producer edits the plan; the brand manager approves the selected version; the team completes the shoot; approved imagery becomes eligible for publication. Later, real results inform a *proposed* brand update, not an automatic overwrite.

## Principles that should survive every feature

- **Humans decide; AI assists.** AI can research, draft, compare, recommend, and prepare actions. No autonomous publish, booking, payment, deletion, or sensitive durable change.
- **One trusted identity and workspace.** Tenant and user authorization are enforced server-side; never trust browser org IDs, user-editable metadata, agent output, or possession of a secret alone.
- **Evidence over confident guesses.** Show citations, provenance, real timestamps, empty states, and uncertainty; never invent analytics or completed actions.
- **An editable answer, not an agent maze.** Keep the operator in control through understandable UI and recoverable drafts.
- **Reuse before build.** Prefer current iPix behavior, installed APIs, official provider features, and verified legacy *pure logic/UI*, not old infrastructure.
- **One owner for each truth.** Supabase/Postgres owns application state; Mastra handles AI orchestration and memory; CopilotKit/AG-UI renders interaction; Cloudinary handles media; publishing/commerce providers own their records; Linear tracks delivery.
- **Deliver a complete vertical slice before breadth.** A smaller tested Brand → Plan → Approval → Shoot journey is more valuable than many disconnected mock screens.

## Product boundaries and non-goals

iPix is not intended to replace Photoshop, Cloudinary media processing, all commerce backends, or every social platform. It should coordinate those systems through their supported APIs. Avoid separate task registries, competing agent runtimes, arbitrary agent autonomy, or demo data presented as business truth.

Model Agency and Model Search Contest capabilities have their own [Linear epics](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues); they are related product expansions, **not prerequisites** for the basic Brand → Shoot → Assets path.

## How to recognize product value

Measure *observed* time to approved Brand DNA and shoot plans; accepted versus heavily rewritten proposals; successful authenticated end-to-end journeys; duplicate-action prevention; org-isolation failures; useful approved assets; and, once implemented, real campaign/asset outcomes.

The quantitative goals and release gates belong in the [master PRD](./prd.md). Treat targets as hypotheses until instrumented. Never report a capability as **implemented** merely because this intent describes it.

## Decision test for a new feature

Before writing code, ask: **Who needs this? What decision becomes easier? What real record or approved result changes? Can an existing iPix or provider feature do it? How will we prove it to a user?**

For the answer in functional detail, read [spec.md](./spec.md). For milestones and implementation discipline, read [plan.md](./plan.md).

**Sources of truth:** [PRD](./prd.md) (requirements), [sitemap](./sitemap.md) (routes), [roadmap](./roadmap.md) (durable sequence), [ADRs](./adr/README.md) (accepted decisions), [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) (live execution), [AGENTS.md](../AGENTS.md) (engineering rules).
