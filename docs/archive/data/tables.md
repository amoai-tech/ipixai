Yes. I connected directly to the live Supabase project and checked PostgreSQL itself.

## Live result

There are **191 base tables across 11 schemas** right now.

| Schema                |  Tables | Main purpose                             |
| --------------------- | ------: | ---------------------------------------- |
| `public`              |  **84** | Main iPix/FashionOS business data        |
| `mastra`              |  **34** | AI runtime, memory, workflows, agents    |
| `auth`                |  **23** | Supabase authentication                  |
| `planner`             |  **11** | Planning, tasks, dependencies, approvals |
| `realtime`            |  **10** | Supabase Realtime internals              |
| `shoot`               |   **8** | New AI-native shoot system               |
| `talent`              |   **8** | Talent discovery, shortlist, bookings    |
| `storage`             |   **8** | Supabase Storage internals               |
| `cron`                |   **2** | Scheduled database jobs                  |
| `supabase_migrations` |   **2** | Supabase migration tracking              |
| `vault`               |   **1** | Secrets/vault infrastructure             |
| **Total**             | **191** |                                          |

The most useful number for iPix development is **145 custom/application tables**:

**84 public + 34 Mastra + 11 planner + 8 shoot + 8 talent = 145.**

The remaining **46** are mostly Supabase-managed infrastructure such as Auth, Storage, Realtime and migrations.

Your older July inventory recorded **114 tables**, so the database has expanded substantially since that audit. 

---

# Best way to understand the 145 iPix tables

Instead of thinking of this as one huge database, treat it as several product systems.

| Area                              | Important tables                                                                                                                                                                                      | What feature it supports                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 🧠 **Brand Brain / Intelligence** | `brands`, `brand_scores`, `brand_intake_drafts`, `brand_competitors`, `brand_social_channels`, `brand_crawls`, `brand_crawl_results`, `brand_agent_results`, `brand_graph_nodes`, `brand_graph_edges` | URL → research → Brand Brain → approval                |
| 🤖 **AI governance**              | `ai_agent_logs`, `agent_context_snapshots`, `agent_decision_log`                                                                                                                                      | Agent evidence, context and human approval audit       |
| 🧩 **Mastra runtime**             | `mastra_agents`, `mastra_threads`, `mastra_messages`, `mastra_workflow_snapshot`, `mastra_schedules`, `mastra_observational_memory`, `mastra_resources`                                               | Agents, memory, conversations and workflow persistence |
| 📋 **Planner**                    | `planner.workflows`, `planner.phases`, `planner.tasks`, `planner.dependencies`, `planner.assignments`, `planner.gate_approvals`, `planner.gate_conditions`                                            | Campaign/shoot/project execution planning              |
| 🎯 **Campaigns**                  | `campaigns`, `campaign_deliverables`                                                                                                                                                                  | Campaign strategy → channel requirements → shoots      |
| 📸 **Shoot OS — new**             | `shoot.shoots`, `shoot.shot_list`, `shoot.shoot_deliverables`, `shoot.shoot_crew`, `shoot.shoot_assets`, `shoot.shoot_intake_drafts`, `shoot.shot_deliverable_links`, `shoot.shot_type_references`    | AI shoot planning and production                       |
| 👤 **Talent OS — new**            | `talent.talent_profiles`, `talent.talent_availability`, `talent.talent_shortlists`, `talent.talent_shortlist_items`, `talent.bookings`, `talent.booking_status_history`, `talent.agency_talent`       | Find model → shortlist → check availability → book     |
| 🖼️ **Assets / Cloudinary**       | `assets`, `asset_variants`, `asset_links`, `asset_events`, `cloudinary_assets`                                                                                                                        | Upload → analyze → approve → reuse assets              |
| 🛍️ **Commerce links**            | `commerce_product_links`, `shopify_*`, `amazon_*`                                                                                                                                                     | Asset → product → commerce/channel                     |
| 📱 **Social / publishing data**   | `instagram_connections`, `instagram_posts`, `facebook_connections`, `facebook_posts`                                                                                                                  | Social account connections and published content       |
| 💬 **Messaging / intake**         | `chatbot_conversations`, `chatbot_messages`, `chatbot_events`, `lead_intake_drafts`                                                                                                                   | Conversational onboarding and leads                    |
| 🤝 **CRM**                        | `crm_companies`, `crm_contacts`, `crm_deals`, `crm_activities`                                                                                                                                        | Sales/client pipeline                                  |
| 🎪 **Events**                     | `events`, `event_schedules`, `event_phases`, `event_assets`, `event_sponsors`, `event_models`, `event_designers`, `registrations`, `ticket_tiers`, `venues`, etc.                                     | Fashion shows/events/ticketing/sponsorship             |
| 👥 **Organizations**              | `organizations`, `org_members`, `profiles`, `organizer_teams`, `organizer_team_members`                                                                                                               | Multi-user/tenant ownership                            |
| 🔔 **Notifications**              | `notifications`, `notification_reads`                                                                                                                                                                 | User alerts                                            |
| 📐 **Channel specifications**     | `platforms`, `image_specs`, `image_type_defs`, `media_size_specs`, `recommendation_rules`                                                                                                             | Amazon/Shopify/social deliverable requirements         |

---

# Recommended iPix development phases

The tables actually line up well with the newer iPix roadmap.

### Phase 1 — Core Foundation

Focus here first:

**Identity → AI runtime → authorization → planning**

```text
Supabase Auth
      ↓
organizations / org_members
      ↓
Mastra runtime
      ↓
planner
      ↓
approval / audit logs
```

Relevant schemas/tables:

`auth.*`
`organizations` / `org_members` / `profiles`
`mastra.*`
`planner.*`
`agent_decision_log`

This should be extremely stable before expanding the product.

---

### Phase 2 — Core MVP

This should create the first complete iPix journey:

```text
Brand URL
   ↓
Brand Brain
   ↓
Campaign
   ↓
Shoot Plan
   ↓
Talent
   ↓
Assets
   ↓
Approval
```

Main data:

**Brand**
`brands`
`brand_intake_drafts`
`brand_scores`
`brand_competitors`
`brand_social_channels`

**Campaign**
`campaigns`
`campaign_deliverables`

**Shoot**
all **8 `shoot.*` tables**

**Talent**
all **8 `talent.*` tables**

**Assets**
`assets`
`cloudinary_assets`
`asset_variants`
`asset_events`

This matches the campaign → shoot separation already defined in your iPix PRDs. Campaigns own planning while Shoot OS owns execution.  

---

### Phase 3 — Revenue / Operations

Once the above journey works:

```text
Approved assets
    ↓
Product linking
    ↓
Publishing
    ↓
CRM / client communications
    ↓
Revenue
```

Use:

`commerce_product_links`
Shopify / Amazon integration tables
Instagram / Facebook tables
CRM tables
chatbot/lead tables
notifications

Important architectural rule: iPix's commerce PRD says mutable catalog/order/payment truth should **not migrate into these Supabase tables**; Mercur/Medusa remains commerce truth while Supabase stores links/intelligence. 

---

### Phase 4 — Advanced

Then activate the more sophisticated infrastructure already present:

`brand_graph_nodes`
`brand_graph_edges`

Mastra:

`mastra_experiments`
`mastra_experiment_results`
`mastra_scorers`
`mastra_datasets`
`mastra_observational_memory`
`mastra_background_tasks`
`mastra_schedules`

This gives iPix:

**performance learning → evaluations → better agents → stronger Brand Brain**

Do not put these on the MVP critical path.

---

# One important finding

You now have **two generations of shoot data**.

### Legacy in `public`

`public.shoots`
`public.shoot_items`
`public.shoot_assets`
`public.shoot_payments`

### New dedicated `shoot` schema

`shoot.shoots`
`shoot.shot_list`
`shoot.shoot_assets`
`shoot.shoot_crew`
`shoot.shoot_deliverables`
`shoot.shoot_intake_drafts`
`shoot.shot_deliverable_links`
`shoot.shot_type_references`

That is **intentional-looking and much cleaner**, but it is also a place where developers could accidentally query the wrong `shoots` or `shoot_assets`.

The Shoot PRD previously identified exactly this problem: the old FashionOS tables had different service-booking semantics, while the new system should use a brand-oriented AI-native model. 

### Recommendation

Treat:

**`shoot.*` = canonical new iPix Shoot OS**

and classify:

**`public.shoots`, `public.shoot_items`, `public.shoot_assets`, `public.shoot_payments` = legacy compatibility**

unless repository/runtime inspection proves something still actively depends on them.

---

# Overall database structure

```text
                         iPix
                          │
          ┌───────────────┼────────────────┐
          ↓               ↓                ↓
     PRODUCT DATA      AI RUNTIME       PLATFORM
          │               │                │
       public.*         mastra.*          auth.*
       shoot.*                             storage.*
       talent.*                            realtime.*
       planner.*
          │
          ↓
 Brand → Campaign → Shoot → Talent → Assets
                         │
                         ↓
                  Commerce / Publish
                         │
                         ↓
                  Analytics / Learning
```

## Score

**Domain separation: 91/100**
The new `shoot`, `talent`, `planner`, and `mastra` schemas are a major improvement.

**AI architecture: 94/100**
Mastra has proper dedicated persistence rather than mixing runtime tables into business tables.

**MVP clarity: 86/100**
Main deduction is the old/new duplicate shoot concepts plus substantial EventOS legacy data in `public`.

**Maintainability: 88/100**
Good direction, but `public` is still carrying **84 tables** from several generations/products.

**Overall: 90/100.**

### Faster/better approach:

**Do not reorganize 191 tables now.** Keep the physical database stable and establish a **canonical ownership map**:

```text
public  → shared iPix business truth
planner → planning truth
shoot   → Shoot OS truth
talent  → Talent/booking truth
mastra  → AI runtime truth
auth    → identity truth
```

Then mark legacy EventOS and legacy shoot tables as **keep / migrate / retire** after dependency analysis. That is far safer than attempting a large schema cleanup while the MVP is being built.

### Summary:

* **191 total database tables**
* **145 are iPix/application/runtime tables**
* `public` = **84**
* `mastra` = **34**
* `planner` = **11**
* `shoot` = **8**
* `talent` = **8**
* The best MVP path is **Brand → Campaign → Shoot → Talent → Assets → Approval**
* The biggest cleanup issue is **legacy `public.shoot*` vs canonical `shoot.*`**, not a shortage of tables.
