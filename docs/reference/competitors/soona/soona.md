# Soona historical UX research

> **Status:** Historical competitor research. This note is reference evidence only; it is not current Soona product truth and it is not iPix architecture, schema, or Linear-task truth. Re-verify current capabilities and pricing before product decisions. See [../README.md](../README.md) for provenance.

**Observation date:** Historical screenshot collection restored from the recorded source commit. Exact capture dates for every screen are not independently verified in this restored copy.

## Executive summary

Soona's strongest product pattern is a guided content-production journey that starts with business intent and progressively asks for production details.

The historical screenshots show a flow broadly like:

```text
choose content type
→ choose package / quantity
→ choose scenes
→ choose models / talent
→ add upgrades
→ confirm virtual / production options
→ review price
→ schedule / pay
→ receive content
```

This is valuable because operators do not need to know photography terminology before they start.

## What the historical screenshots show

The restored collection includes examples of:

- dashboard / project navigation
- gallery / products / talent / insights / competition areas
- campaigns
- shoot builder
- quantity selection
- scene selection
- model/talent selection
- upgrades
- virtual-shoot options
- payment / checkout
- video workflow
- UGC workflow
- product intake
- packaged content offerings

Relevant screenshots include:

- `1-dash.png`
- `1A-dash.png`
- `1C-dash-gallery.png`
- `1D-dash-products.png`
- `1E-dash-talent.png`
- `1F-dash-insights.png`
- `1G-dash-competition.png`
- `1H-campaigns.png`
- `2-shoot-build.png`
- `3-shoot-quantity.png`
- `3-shoot-scenes.png`
- `4-shoot-models.png`
- `5-shoot-upgrades.png`
- `6-shoot-virtual.png`
- `7-shoot-payment.png`

## User journey patterns

### 1. Start with what the user is trying to make

The historical flow asks recognizable business questions before technical production questions.

Examples include content type, channel/use case, quantity, and scene choice.

This is better than opening with a large production brief because most brand operators know:

> “I need social videos and PDP images.”

They may not yet know:

> exact camera angle, lighting setup, crop set, or production package.

### 2. Progressive disclosure

The workflow reveals decisions in sequence instead of presenting one giant form.

That reduces cognitive load and makes each choice feel reversible and understandable.

### 3. Visual selection

Scene/model/package choices are shown visually. This is especially useful for fashion because the operator can compare a production direction rather than interpret abstract labels.

### 4. Outcome-oriented packages

The historical research included packaged offerings that bundled content outputs rather than exposing only individual production line items.

One old note recorded an Amazon-oriented package at **$999**. Treat that as a **historical, unverified pricing observation**, not current Soona pricing or current capability truth.

The useful pattern is the packaging concept:

```text
customer goal
→ recommended content bundle
→ clear included outputs
→ one understandable decision
```

## Product intake pattern

The historical workflow asks the customer to identify the products that will appear in the content.

Observed/intended product concepts in the old research included:

- product name
- value / price context
- product URL
- description
- industry/category
- product images

The old note also proposed importing variants and materials from commerce sources. That proposal is **not a persisted-schema contract** in this reference document.

For iPix, product data should come from the current commerce/product source of truth rather than a new schema invented from this competitor note.

## Creator / talent pattern

Soona places creator/model preferences inside the content-production flow. That is useful because talent is a production dependency, not an unrelated afterthought.

The iPix lesson is:

```text
plan says talent is needed
→ recommend criteria / candidates
→ human selects
→ booking domain handles availability / confirmation
→ selected talent appears in the shoot plan
```

Do not duplicate the Talent/Booking source of truth inside the Shoot Wizard.

## Dashboard / intelligence pattern

The historical screenshots include product, talent, insights, competition, and campaign areas in one operational environment.

This supports the broader iPix product direction: the operator should not have to jump between unrelated systems to understand brand, campaign, production, talent, and content status.

The important distinction is that iPix should connect these domains through shared context and source-of-truth links rather than duplicating each domain's data.

## What Soona does well

1. **Goal-first setup** — starts with what the customer needs.
2. **Progressive disclosure** — asks one category of decision at a time.
3. **Visual choices** — scenes, models, and packages are easier to evaluate visually.
4. **Outcome bundles** — packages simplify buying and planning decisions.
5. **Clear commercial consequence** — upgrades and price are visible as the plan changes.

## What iPix should do better

The AI-native version should reduce manual setup:

```text
Brand Brain
+ product catalog
+ campaign objective
+ target channels
        ↓
AI proposes content mix / deliverables
        ↓
operator reviews visual options
        ↓
AI proposes shot plan / talent needs / production assumptions
        ↓
operator edits and approves
        ↓
canonical iPix save / booking / asset workflows execute
```

The user should not have to manually configure every option that iPix can infer from approved brand and campaign context.

## Recommended iPix UX patterns

### Goal-first Shoot Wizard

Start with:

- What are you launching?
- Which products?
- Which channels?
- What outcome matters?
- What budget/range?

Then infer production details and ask only for unresolved decisions.

### AI package proposal

Instead of forcing the operator to pick every deliverable manually, propose a reviewable bundle such as:

```text
Recommended launch plan
- PDP hero / detail set
- social feed crops
- vertical short-form video
- UGC variation
- campaign hero asset
```

Every quantity/spec that is not confirmed truth should remain clearly marked as an assumption until the operator approves it.

### Visual scene/talent recommendations

Use visual cards with explanation, not bare AI text.

The operator should be able to keep, replace, or edit any recommendation before it becomes durable production truth.

## What not to copy

Do not use this historical competitor note to define current iPix:

- database tables
- product schema
- agent/runtime architecture
- payment ownership
- booking ownership
- current Linear task mappings
- current Soona pricing/capabilities

Current iPix code, Supabase contracts, architecture docs, and live Linear issues remain authoritative.

## Bottom line

Soona's strongest lesson is **progressive, visual, goal-first production setup**.

The iPix improvement is to make that flow AI-assisted from approved Brand Brain, campaign, product, and channel context while keeping consequential saves human-approved.
