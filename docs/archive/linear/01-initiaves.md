Best practice for **iPix V2**: **keep one top-level Initiative for now, do not create sub-initiatives yet, and start using Initiative Updates immediately.**

Linear’s current model is clear: Initiatives should represent **strategic goals**, Projects represent the **execution workstreams that deliver them**, and sub-initiatives are for genuinely large programs with multiple departments, phases, quarters, or independently managed strategic workstreams. ([Linear](https://linear.app/docs/initiatives?utm_source=chatgpt.com "Initiatives – Linear Docs"))

## Current iPix V2 setup

Verified live:

```text
Initiative
iPix V2 — AI-Native Production Platform

Owner
S K

Lead team
iPix1

Status
Active

Priority
High

Projects
└── v2-ipix

Sub-initiatives
none

Target date
none

Latest initiative update
none
```

The basic setup is correct. The biggest weakness is **not hierarchy**. It is missing strategic reporting.

## Recommended iPix V2 initiative model

```text
iPix V2 — AI-Native Production Platform
│
└── v2-ipix
    ├── M1 Foundation
    ├── M2 Product Workspace & Planning
    ├── M3 Production
    ├── M4 Campaigns
    ├── M5 Measurement
    ├── M6 Learning
    ├── M7 Scale
    └── Parallel Security & Reliability
```

Do **not** turn these milestones into sub-initiatives.

That would duplicate hierarchy:

```text
BAD

Initiative
├── Foundation sub-initiative
├── Product sub-initiative
├── Production sub-initiative
├── Campaign sub-initiative
...
      ↓
same v2-ipix project
      ↓
same milestones again
```

Linear says sub-initiatives are for organizing multiple initiatives across large goals, departments, quarters, or strategic themes, and the parent automatically rolls up projects from children. They can nest up to five levels and are Enterprise-only. ([Linear](https://linear.app/docs/sub-initiatives?utm_source=chatgpt.com "Sub-initiatives – Linear Docs"))

For one project, they add management overhead without better information.

## What I would improve

|Area|Current|Recommendation|
|---|---|---|
|Initiative name|Good|Keep|
|Strategic description|Good after correction|Keep concise|
|Owner|Set|Keep|
|Lead team|iPix1|Keep|
|Status|Active|Correct|
|Priority|High|Correct|
|Project|`v2-ipix`|Correct|
|Sub-initiatives|None|**Keep none**|
|Target date|Missing|Add only when M1–M3 schedule is credible|
|Health|Missing|**Start using updates**|
|Latest update|None|**Create now**|
|Update cadence|None|Weekly or biweekly|
|Resources|Minimal|Attach operating plan + architecture/roadmap references|

### 1. Start Initiative Updates

This is the highest-value missing feature.

Linear explicitly designed Initiative Updates to summarize strategic progress across projects using:

```text
Health
On track / At risk / Off track

+
progress
+
important changes
+
risks
+
next steps
```

The latest update becomes visible directly on the Initiative and Initiative list. ([Linear](https://linear.app/docs/initiative-and-project-updates?utm_source=chatgpt.com "Initiative and Project updates – Linear Docs"))

For iPix I recommend **weekly**, because development is moving quickly.

Use this format:

```text
Health: On track / At risk / Off track

Outcome this week
What materially improved for the iPix user?

Progress
M1:
M2:
M3:
Security:

Risks / blockers
Only issues affecting the strategic outcome.

Next
3–5 concrete outcomes for the next week.
```

Do not reproduce every Linear issue. The Initiative update is for strategic signal.

### 2. Separate Initiative Update from Project Update

This is important.

**Initiative update:**

```text
Are we still on course to build the iPix V2 product?
What major outcome changed?
What is at risk?
```

**v2-ipix Project update:**

```text
What did we ship this week?
Which milestone moved?
What is blocked?
What is next?
```

Linear explicitly separates initiative updates for high-level alignment from project updates for more granular execution. ([Linear](https://linear.app/docs/initiative-and-project-updates?utm_source=chatgpt.com "Initiative and Project updates – Linear Docs"))

For iPix:

```text
Initiative update
~5–10 lines

Project update
~10–20 lines
```

### 3. Use Health instead of prose like “everything is going well”

Health should come from actual execution evidence.

Example:

```text
On track
M1 blockers closing, APP shell near merge,
Cloudinary foundation advancing.

At risk
M1 is stalled by HOST-RUNNER or Planner certification
and M2 cannot begin meaningful integration.

Off track
Critical architecture/security blocker invalidates
the current delivery sequence.
```

Linear exposes Initiative Health from the latest update and rolls active-project health into the Initiative view. ([Linear](https://linear.app/docs/initiatives?utm_source=chatgpt.com "Initiatives – Linear Docs"))

### 4. Do not add a target date yet just to fill the field

Linear recommends target dates for tracking timing across initiatives. ([Linear](https://linear.app/docs/initiatives?utm_source=chatgpt.com "Initiatives – Linear Docs"))

But an arbitrary date would be worse than none.

iPix currently has:

```text
M1 ~53%
M2 0%
M3 ~10%
```

The right order is:

```text
date M1
→ estimate M2 based on actual M1 throughput
→ date M3
→ then set an Initiative target
```

If you want a planning horizon, use a **quarter/month resolution**, not fake day-level precision.

### 5. Add Initiative labels only when they help portfolio comparison

Current initiative has no labels. That is fine with one initiative.

Linear recommends labels for cross-cutting dimensions such as product line, region, company goal, or planning period. ([Linear](https://linear.app/docs/initiatives?utm_source=chatgpt.com "Initiatives – Linear Docs"))

Do **not** add:

```text
Mastra
Cloudinary
Supabase
CopilotKit
```

Those are execution technologies, not strategic initiative attributes.

Useful future labels might be:

```text
Product: iPix
Bet: Core Platform
Horizon: 2026
```

But with a single initiative today, even these add little value.

### 6. Keep one accountable owner

This is already correct.

Linear specifically recommends one Initiative owner because it gives clear accountability for decisions and updates. ([Linear](https://linear.app/docs/initiatives?utm_source=chatgpt.com "Initiatives – Linear Docs"))

Do not spread ownership across several people. Contributors belong on projects/issues.

### 7. Use the lead team

You already have `iPix1` as lead team, which is good.

Linear added explicit lead-team ownership so teams can show how their strategic work ladders into broader company goals. ([Linear](https://linear.app/changelog/2026-08-13-team-initiatives?utm_source=chatgpt.com "Team initiatives – Changelog"))

Keep:

```text
Initiative owner = accountable person
Lead team = iPix1
Project lead = execution owner
Issue assignee = delivery owner
```

### 8. Add sub-initiatives later only when this happens

Create a sub-initiative only if iPix evolves into several independently managed projects, for example:

```text
iPix V2 — AI-Native Production Platform

├── Core Product Experience
│   ├── Operator Workspace project
│   ├── Brand Intelligence project
│   └── Production Planner project
│
├── Commerce
│   ├── Marketplace project
│   └── Storefront project
│
└── Growth & Campaigns
    ├── Campaign Platform project
    └── Measurement project
```

At that point the hierarchy earns its complexity.

Today:

```text
1 initiative
1 execution project
```

means **no sub-initiatives** is the cleaner Linear-native structure.

## Recommended update cadence

Linear supports scheduled Initiative and Project update reminders, including weekly and biweekly schedules. Reminders go to owners/leads, and stale projects can be surfaced when updates are overdue. ([Linear](https://linear.app/docs/initiative-and-project-updates?utm_source=chatgpt.com "Initiative and Project updates – Linear Docs"))

For iPix:

```text
Weekly
Project update: v2-ipix

Biweekly
Initiative update: iPix V2
```

Because you're moving quickly, I would actually start with **weekly for both** until M1/M2 stabilize.

## Strongest improvement right now

The Initiative currently has **zero status updates**.

That means Linear cannot show meaningful initiative health even though it has an owner, status, project, and priority.

So the next improvement is not another hierarchy layer.

It is:

```text
Initiative
Active
High priority
Owner = S K
Lead team = iPix1
        ↓
Weekly update
        ↓
Health = On track / At risk / Off track
        ↓
v2-ipix project progress rolls underneath
```

**Faster/better approach:** keep the hierarchy flat until multiple real projects exist. Add a recurring Initiative update discipline before adding sub-initiatives, labels, or portfolio complexity.

### Summary:

- **Best decision:** keep `iPix V2 → v2-ipix` exactly as the hierarchy.
    
- **Biggest gap:** no Initiative health/update history.
    
- **Do not add:** sub-initiatives for M1–M7.
    
- **Next action:** create the first concise **iPix V2 Initiative Update** and establish a weekly cadence.