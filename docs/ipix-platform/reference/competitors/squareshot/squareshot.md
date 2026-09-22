# Squareshot historical UX research — June 2026

> **Status:** Historical competitor research. This note is reference evidence only; it is not current Squareshot product truth and it is not iPix architecture, schema, or Linear-task truth. Re-verify current capabilities and pricing before product decisions. See [../README.md](../README.md) for provenance.

**Observation period:** June 2026 historical browser/screenshots.

**Privacy:** Live-session identity, account names, account identifiers, brief/project identifiers, and exact account-state metadata have been removed from this restored copy.

## Executive summary

Squareshot demonstrates a strong self-service ecommerce content-production workflow built around a structured brief. The most valuable pattern for iPix is not the exact pricing or schema; it is the progression from service selection to product/model details, visual shot references, a shot list, and a live order summary.

The strongest lesson is:

```text
service / goal
→ structured brief
→ products / models
→ visual shot references
→ shot list
→ review / submit
→ production
→ image selection
→ retouching / delivery
```

## What the historical screenshots show

The restored screenshots support these product patterns:

- dashboard with unfinished briefs/projects
- service-selection cards
- Visual Concept, Product Shoot, Model Shoot, and AI-related service options
- structured product-shoot and model-shoot briefs
- model settings and measurements
- visual reference browsing
- shot-list item creation
- shot detail metadata
- sticky summary / pricing context

Relevant screenshots in this directory include:

- `3-dash.png`
- `3-home.png`
- `4-VISUAL-CONCEPT.png`
- `5-VISUAL-brief.png`
- `6-shoot-brief.png`
- `7-product-brief.png`
- `8-model-brief.png`
- `8A-model-brief.png`
- `8B-model-brief.png`
- `8C-model-brief.png`
- `8D-model-brief.png`
- `8G-shotlist-reference.png`
- `9A-shotlist.png`
- `9B-shotlist.png`
- `9F-shotlist.png`

## User journey

### 1. Start from a project/brief dashboard

The historical dashboard separates unfinished briefs from active/project work. The useful pattern is clear resume-state visibility: users can see what is incomplete and continue it.

### 2. Choose a production service

The service selector uses a small set of visually distinct cards with concise descriptions and pricing context. This reduces ambiguity for users who do not know production terminology.

Historical pricing shown in the research included examples such as per-image and fixed-session pricing. Treat all prices as **historical observations**, not current confirmed pricing.

### 3. Capture a structured product or model brief

The briefs collect production decisions in structured fields rather than relying on one free-text request. Historical fields included product/item grouping, item images, project description, image specifications, retouching/delivery choices, model source, measurements, outfit sourcing, and creative notes.

### 4. Build the shot list visually

This is the strongest pattern in the collection.

The user can:

```text
add product / outfit
→ browse reference shots
→ inspect shot metadata
→ select a shot/reference
→ assign quantities / notes
→ return to the brief summary
```

A visual reference makes a production instruction concrete in a way that text such as “editorial close-up” often does not.

### 5. Keep consequences visible

The sticky summary keeps item counts, image counts, service choices, timing, add-ons, and estimated cost visible while the brief changes.

This is valuable because it makes production consequences visible at the moment the operator changes the plan.

## Visual reference library

The historical research shows a reference-browser pattern with categories, search/filter controls, reference thumbnails, a detail panel, metadata, and a selection action.

Observed metadata concepts included:

- service type
- category
- angle
- model source/type
- background
- collections

The exact historical library counts recorded in the old audit should not be treated as current truth without re-verification.

## Model workflow

The historical model-shoot screens show that talent selection is embedded directly in shoot planning rather than treated as an unrelated application.

Useful UX concepts include:

- selected model preview
- body/session type
- measurements
- model source
- outfit sourcing
- number of outfits

For iPix, the product lesson is to keep talent selection connected to the shoot plan while preserving the Talent/Booking domain as its own source of truth.

## What Squareshot does well

1. **Visual communication** — users can choose examples instead of describing every shot in prose.
2. **Progressive brief building** — complex production decisions are broken into understandable sections.
3. **Structured data capture** — product/model/shot decisions become explicit.
4. **Live summary** — quantity, timing, and cost consequences stay visible.
5. **Clear next action** — each stage makes the next step obvious.

## What iPix should learn from it

The best iPix adaptation is not to reproduce Squareshot's exact workflow manually.

A better AI-native flow is:

```text
Brand Brain
+ campaign objective
+ products
+ target channels
        ↓
AI proposes deliverables
        ↓
AI ranks trusted visual shot references
        ↓
operator visually replaces / edits / keeps shots
        ↓
operator approves exact plan revision
        ↓
approved plan is saved through the canonical iPix write path
```

The AI should reduce manual setup while visual references keep the plan understandable and reviewable.

## Recommended iPix UX patterns

### Visual shot/reference picker

Show each planned shot as a visual card with:

- trusted reference image
- shot type / angle
- mapped deliverables/channels
- product
- talent requirement
- explanation / evidence
- Replace reference
- Edit
- Keep

### Coverage view

Make missing production coverage visible:

```text
Shopify PDP
✓ Hero
✓ Back
✓ Detail
⚠ Side — not captured

Instagram Reel
✓ Vertical lifestyle
```

This would connect planning to actual production completeness rather than ending at a generated shot list.

### Goal-first wizard

Start with business questions the brand operator understands:

- What are you launching?
- Which products?
- Which channels?
- What outcome matters?
- What budget/range?

Then let iPix infer production details and ask only for unresolved decisions.

## What not to copy

Do not copy historical implementation assumptions from this old audit. In particular:

- do not derive current iPix database tables from this document
- do not treat old edge-function names or save flows as current architecture
- do not duplicate shot-to-deliverable ownership
- do not use historical Linear mappings as task truth
- do not treat historical prices or library counts as current competitor facts

Current iPix code, Supabase contracts, architecture documents, and live Linear issues remain authoritative.

## Bottom line

Squareshot's strongest product lesson is **visual, structured production planning**. iPix can improve on that by using Brand Brain and Planner context to generate the first draft, then letting the operator review the plan visually before any consequential save.

That is the part of the competitor workflow worth preserving and adapting.
