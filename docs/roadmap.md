# iPix product roadmap

**Linear owns live task status, blockers, assignees, and execution.**
This page owns only the durable product sequence: **Now → Next → Later**.

Live execution: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## North star

```text
Brand URL
→ approved Brand DNA
→ campaign / shoot plan
→ human approval
→ production
→ assets
→ Cloudinary
→ quality / DNA review
→ product + channel use
→ publishing
→ analytics
→ learning back into Brand Brain
```

## Now — reliable operator foundation

The immediate goal is one trustworthy end-to-end operator experience, not broad feature count.

| Outcome | What “done” means |
|---|---|
| Secure identity + tenancy | The server derives the trusted user/org; cross-org access is denied |
| Durable AI runtime | Planner conversation survives refresh/restart on hosted Postgres |
| Production Planner | Structured fashion-production planning works through the current CopilotKit + Mastra runtime |
| Human approval | Consequential writes are proposed, reviewed, then committed once |
| Core operator workspace | Dashboard, Brands, Shoots, and Planner use one consistent authenticated shell |
| Media foundation | Signed upload, verified webhook, private delivery, and Supabase ownership boundaries are proven |
| Release evidence | Targeted tests, build, authenticated E2E, and hosted proof support every critical claim |

## Next — complete the fashion-production MVP

| Journey | Outcome |
|---|---|
| Brand intelligence | Website → cited editable Brand DNA draft → human approval → saved Brand Brain |
| Shoot planning | Brief → deliverables → shot list → budget → approval → safe shoot save |
| Shoot execution | Shoot workspace → assets → review → approval → delivery |
| Talent / booking | Search → shortlist → booking proposal → human confirmation |
| CRM | Company/contact/deal context connects safely to brands and production |
| Campaigns | Approved Brand DNA and assets become reusable campaign inputs |
| Intelligence rail | Relevant risks, context, and next actions appear without taking control from the operator |

## Later — performance and automation

| Area | Outcome |
|---|---|
| Publishing | Approved content can be handed to publishing systems with human control |
| Analytics | Asset/campaign/channel performance is measured without fabricated KPIs |
| Learning loop | Performance evidence improves future Brand Brain recommendations |
| Advanced agent workflows | Evals, schedules, browser/research, task/tool search, and reusable SOPs are added only when the core journey needs them |
| Collaboration | Shared production context expands to approved multi-user workflows with explicit authorization |
| Commerce | Product and order truth stays in the commerce system; iPix links creative assets and intelligence to it |

## Architecture boundaries

| System | Owns |
|---|---|
| Supabase/Postgres | Durable application truth and tenant-protected domain state |
| Mastra | Agents, tools, workflows, memory orchestration |
| CopilotKit / AG-UI | Interactive AI experience and generative UI |
| Cloudinary | Image/video bytes, transforms, and delivery |
| Commerce systems | Catalog, cart, order, seller, and payout truth |
| Linear | Current development status, blockers, and ownership |

## Rules

- Humans decide; AI assists.
- Reuse current iPix implementation before building new infrastructure.
- Current repository and installed types beat historical planning docs.
- Build the shortest complete user journey before expanding horizontally.
- Optional advanced features do not block MVP.
- A merged PR is not “Done” until the observable workflow is verified.

## Related current docs

- [Product requirements](./prd.md)
- [Product sitemap](./sitemap.md)
- [AI runtime](./copilotkit-mastra/index.md)
- [Data architecture](./data/index.md)
- [Media architecture](./cloudinary/index.md)
- [Documentation inventory](./DOCS-INDEX.md)
