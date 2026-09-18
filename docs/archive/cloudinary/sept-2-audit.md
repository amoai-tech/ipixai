Yes. I audited the listed Linear tasks against the current Cloudinary docs, official GitHub repos, and the live task descriptions. The roadmap is **mostly strong**, but I found **4 critical corrections and several efficiency improvements** that should be made before those tasks execute.

The main rule should be:

> **Cloudinary Dashboard/MCP/CLI → official SDK/component → official example/template → existing iPix implementation → smallest custom iPix wrapper.**

Cloudinary's current platform explicitly provides MCP servers for asset management, environment config, structured metadata, and analysis; the CLI provides `make`, `url`, `regen_derived`, Admin/Upload operations; and the Upload Widget already handles upload UI, queueing, progress, errors, and callbacks. ([Cloudinary][1])

## Critical corrections

| Task                                                                                     |    Current | Required correction                                                                               |
| ---------------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------- |
| **IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot**      | **78/100** | **Outdated after IPI-1122. Use `assets.v2_shoot_id → shoot.shoots`, not `assets.shoot_id`.**      |
| **IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions** | **88/100** | Remove claim that normal signed delivery URL is inherently **time-limited**.                      |
| **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**         | **86/100** | M2 task currently has hard dependency on M3 IPI-1112. Split or move to avoid milestone inversion. |
| **IPI-338 · CHANNEL-PREVIEW-001 — Preview Approved Campaign Content Before Publishing**  | **91/100** | Lock the same canonical channel-spec source as IPI-1138 instead of generic/versioned config.      |

### 1. IPI-1118 is now materially wrong

The task still contains:

```text
assets.shoot_id = this shoot.shoots id
```

and acceptance criteria saying:

```text
Upload from a saved shoot persists assets.shoot_id = that shoot.shoots id
```



That was correct as a warning **before IPI-1122**, but IPI-1122 has now shipped the bridge:

```text
public.assets.shoot_id
→ legacy public.shoots

public.assets.v2_shoot_id
→ canonical shoot.shoots
```

So IPI-1118 should now explicitly say:

```text
signed upload context.v2_shoot_id
→ IPI-1111 webhook correlation
→ public.assets.v2_shoot_id
→ shoot.shoots.id
```

Do not touch `assets.shoot_id`.

**This is the highest-priority Linear correction.**

---

### 2. IPI-1120 incorrectly says “time-limited signed URL”

The task currently says:

> “mint a time-limited signed Cloudinary URL.” 

A standard Cloudinary **signed delivery URL is not inherently expiring**. Its signature protects the requested asset/transformation/version. Time-limited access requires a different mechanism such as token-based access or `private_download_url`; token access can have duration/expiration and is plan-dependent. ([Cloudinary][2])

For the MVP, use:

```text
exact approval
→ exact Cloudinary asset/version
→ allowlisted eager named transform
→ normal signed authenticated delivery URL
```

Treat that URL as a bearer URL.

Only add expiring/tokenized delivery later if the product specifically requires it.

This keeps IPI-1120 smaller and avoids accidentally putting a Premium access-token feature on the MVP critical path.

---

### 3. IPI-1069 has a milestone dependency inversion

Linear currently places **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records** in **M2**, but its definition says it cannot be Done until **IPI-1112 · CLD-DELIVERY-001**, an M3 task, provides secure thumbnails. 

That creates:

```text
M2 task
    ↓ blocked by
M3 task
```

If milestones are dependency ordered, this is wrong.

**Best solution:** move IPI-1069 to **M3**, because a useful private DAM browser depends on the production private-media delivery contract.

Alternative: split it:

```text
M2
Asset workspace shell + metadata list/detail

M3
Secure Cloudinary thumbnail/detail integration
```

I prefer **moving IPI-1069 to M3**. Fewer tickets and clearer user outcome.

---

### 4. IPI-338 needs the canonical channel-spec contract

IPI-1138 correctly says channel readiness must use:

```text
public.image_specs
+ public.platforms
+ public.image_type_defs
```

and must not use deprecated `media_size_specs`. 

IPI-338 currently refers more generically to “channel rules/specs” and “versioned config.” 

That risks creating two sources of truth for:

* aspect ratios
* dimensions
* safe zones
* channel formats

Use exactly the same source:

```text
IPI-1138 QA
        ┐
        ├→ public.image_specs
IPI-338 Preview
        ┘   + platforms
            + image_type_defs
```

Then the preview displays the same constraints the QA engine evaluated.

---

# Best Cloudinary repository/tool use

I verified these repositories are active/not archived:

* `cloudinary/cloudinary_npm` — active.
* `cloudinary-community/next-cloudinary` — active.
* `cloudinary/asset-management-js` — active.
* `cloudinary/structured-metadata-mcp` — active.
* `cloudinary/cloudinary_js` — active.
* `cloudinary-devs/product-launch-agent` — active.

The right use is **not to install all of them**.

| Official project            | Use in iPix                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| **cloudinary_npm**          | **Core server SDK** — signing, URL generation, Admin/Upload APIs, notification verification |
| **next-cloudinary**         | **IPI-1116 Upload Widget**; rendering convenience where appropriate                         |
| **cloudinary-examples**     | Reference **IPI-1110 / IPI-1116** signed Next.js upload implementation                      |
| **Cloudinary CLI**          | Proof/config inspection before app code                                                     |
| **Asset Management MCP**    | IPI-1114 reconciliation and provider inspection                                             |
| **Environment Config MCP**  | presets, named transforms, webhook config                                                   |
| **Analysis MCP**            | Optional IPI-1136 / IPI-1138 semantic/quality analysis                                      |
| **Structured Metadata MCP** | Optional Cloudinary-side metadata definitions; **not iPix business truth**                  |
| **asset-management-js**     | IPI-1114 only if repeatable reconciliation needs code after MCP proof                       |
| **cloudinary_js**           | Generally **skip** in V2; `next-cloudinary` + Node SDK already cover Core needs             |
| **create-cloudinary-next**  | Reference/scaffold only; **do not scaffold another app inside iPix**                        |
| **product-launch-agent**    | Pattern/reference for M4 campaign/content workflow, **not Core runtime**                    |

Cloudinary officially recommends MCP for managing assets, environment config, structured metadata and analysis, which makes MCP/Dashboard the cheapest proof for many of these tasks before application code exists. ([Cloudinary][1])

---

# `product-launch-agent` — where it actually helps iPix

This repository is particularly useful for the later campaign tasks.

Its most valuable architectural lesson is **structured constraints instead of prompt instructions**. It requires one image selection per platform in the schema rather than saying “please choose different images,” and its generated outputs are structured records rather than prose that later code must parse.

Use that pattern in:

### IPI-77 · CAMPAIGN-COPY-001

Already strong at **95/100**. 

Improve the output contract to make per-channel media binding structurally mandatory:

```text
ChannelVariant {
  channel
  copy
  asset {
    cloudinary_asset_id
    version
    transform_name
    selection_reason
  }
  status = draft
}
```

That directly reuses the best idea from `product-launch-agent`.

Do **not** copy:

* Anthropic-specific orchestration
* direct dynamic crop constants
* its asset storage assumptions
* separate launch-agent runtime

iPix already has Mastra + Brand Knowledge + approved media.

---

### IPI-1131 · BRAND-CHECK-001

**96/100.**

Its deterministic-first policy is excellent. 

Use Product Launch Agent only as a schema-pattern reference:

```text
one check
→ one structured result
→ exact evidence/rule IDs
→ no prose parsing
```

Cloudinary structured metadata can help with factual visual attributes, but Supabase/Brand Knowledge stays business truth.

---

### IPI-338 · CHANNEL-PREVIEW-001

After the canonical spec correction: **97/100**.

Reuse Product Launch Agent's concept:

```text
channel
→ exact media version
→ channel-specific derivative
→ channel-specific copy
```

but use **IPI-1120 exact approved media delivery**, not Product Launch Agent's dynamic transform approach.

That distinction matters because iPix DAM assets are `authenticated`, and Cloudinary documents that authenticated assets cannot create arbitrary on-the-fly transformations; their derivatives must already exist. ([Cloudinary][3])

---

# Task-by-task efficient path

| Task                                                                                                | Faster/better implementation                                                                                         |           Audit |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------: |
| **IPI-1116 · CLD-UPLOAD-001 — Let Operators Upload Shoot Selects with the Cloudinary Widget**       | `cld make upload_widget` → signed official example → `CldUploadWidget` → reuse 1110 signer                           |      **97/100** |
| **IPI-1113 · CLD-E2E-001 — Prove One Disposable Upload Reaches Supabase Ready**                     | CLI/SDK disposable asset; no feature code                                                                            |      **98/100** |
| **IPI-1114 · CLD-RECONCILE-001 — Detect Cloudinary and Supabase Drift Without Mutating Production** | Asset MCP + Supabase read-only first; script only if recurrence demands it                                           |      **98/100** |
| **IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely**                     | Environment Config MCP/Dashboard native change + exact rollback                                                      |      **98/100** |
| **IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot**                 | Signed `v2_shoot_id` → webhook → `assets.v2_shoot_id`; virtually no new media code                                   | **78 → 98/100** |
| **IPI-1136 · ASSET-DNA-001 — Analyze Uploaded Shoot Assets Against the Approved Brand Brain**       | Existing metadata → approved Brand evidence → one bounded Mastra analysis tool                                       |      **95/100** |
| **IPI-1138 · ASSET-QA-001 — Check Asset Quality and Channel Readiness Before Approval**             | deterministic canonical specs → existing Cloudinary quality data → AI last                                           |      **97/100** |
| **IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version**            | one versioned `asset_events` decision; no Cloudinary mutation                                                        |      **98/100** |
| **IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions**            | reuse 1112 helper + approval-event lookup                                                                            | **88 → 98/100** |
| **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**                    | COPY+CLEAN UI + Supabase + reuse 1112; move to M3                                                                    | **86 → 96/100** |
| **IPI-157 · CAMPAIGN-PLAN-001 — Turn an Approved Strategy Into an Executable Campaign Plan**        | existing campaign/deliverables + one Mastra workflow; use Supabase media index, not Cloudinary search as business DB |      **96/100** |
| **IPI-77 · CAMPAIGN-COPY-001 — Create Brand-Safe Channel Copy From Approved Assets and Strategy**   | adapt Mastra template + Product Launch Agent structured-per-channel pattern                                          |      **97/100** |
| **IPI-1131 · BRAND-CHECK-001 — Check Copy and Media Against the Approved Brand Brain**              | deterministic validators → Brand evidence → semantic AI only where necessary                                         |      **96/100** |
| **IPI-338 · CHANNEL-PREVIEW-001 — Preview Approved Campaign Content Before Publishing**             | existing design + exact media + canonical channel specs + deterministic React                                        | **91 → 97/100** |
| **IPI-195 · PUBLISH-001 — Publish Only Approved Campaign Content Through Postiz**                   | Postiz Dashboard/API owns publishing; iPix only approval/idempotency bridge                                          |      **96/100** |

The two epics should simply encode that sequence rather than duplicate implementation detail:

**IPI-1102 · IPI-EPIC · PRODUCTION & MEDIA — Browse Assets and Deliver Shoot Files**

```text
1110 ∥ 1111 ∥ 1112
→ 1113 ∥ 1114
→ 1116
→ 1118
→ 1136 ∥ 1138
→ 1119
→ 1120
→ 1115 LAST
```

**IPI-1105 · IPI-EPIC · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish**

```text
157
→ 77
→ 1131
→ 338
→ explicit human approval
→ 195
```

Cloudinary's current native tooling supports this reuse-heavy approach: the Upload Widget already provides queue/progress/error handling; CLI `make` can produce upload widget templates; CLI `url --sign --type authenticated --open` can prove delivery; and `regen_derived` exists for named derivatives. ([Cloudinary][4])

## One more important efficiency decision

Do **not** automatically introduce Cloudinary structured metadata for:

```text
org_id
brand_id
shoot_id
approval
campaign_id
```

Supabase already owns those durable relationships.

Cloudinary structured metadata is excellent for provider-native asset descriptors and search fields, but introducing duplicated business ownership there creates another synchronization problem. Cloudinary itself describes structured metadata as custom typed asset metadata/search data. ([Cloudinary][5])

Use it later for things like:

```text
shot_type
orientation
talent
product_category
visual_role
campaign_usage
```

when that provides real DAM search value.

## Correct overall dependency path

```text
                CLOUDINARY CORE
                       │
              1110 ∥ 1111 ∥ 1112
                       │
                 1113 ∥ 1114
                       │
                      1116
                       │
                      1118
                       │
                1136 ∥ 1138
                       │
                      1119
                       │
                      1120
                       │
                 campaigns
                       │
                     157
                       │
                      77
                       │
                     1131
                       │
                      338
                       │
                human approval
                       │
                      195

1115 cutover = operational Cloudinary gate;
keep LAST relative to Cloudinary infrastructure certification.
```

One nuance: **IPI-1114 can begin earlier once IPI-1111's canonical identity rules are stable**; it doesn't need to wait for the whole application UI.

### Production correctness

I would not call any future task “100% correct” merely because its Linear description is good.

The correct standard is:

```text
Planning correctness
→ official docs + official repo + current Linear + current repo

Implementation correctness
→ installed source/types + tests

Production correctness
→ Dashboard/MCP/CLI/live runtime proof
```

That is how these should reach **100% verified**, rather than assigning an artificial 100/100 before execution.

**Summary:**

* **Best decision:** keep the overall roadmap, but correct **IPI-1118, IPI-1120, IPI-1069 and IPI-338** before they execute.
* **Why:** those four currently contain either stale architecture, an incorrect Cloudinary access assumption, a milestone inversion, or duplicate channel-spec risk.
* **Next action:** update those four Linear descriptions/ACs and propagate the corrected dependency chain into **IPI-1102 · IPI-EPIC · PRODUCTION & MEDIA — Browse Assets and Deliver Shoot Files** and **IPI-1105 · IPI-EPIC · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish**.

[1]: https://cloudinary.com/documentation/asset_management?utm_source=chatgpt.com "Programmatic Image and Video Asset Management | Documentation"
[2]: https://cloudinary.com/documentation/delivery_url_signatures?utm_source=chatgpt.com "Generating delivery URL signatures | Documentation"
[3]: https://cloudinary.com/documentation/control_access_to_media?utm_source=chatgpt.com "Media Access Control and Authentication | Documentation"
[4]: https://cloudinary.com/documentation/cloudinary_cli?utm_source=chatgpt.com "Cloudinary Command Line Interface (CLI) | Documentation"
[5]: https://cloudinary.com/documentation/structured_metadata?utm_source=chatgpt.com "Structured Metadata | Documentation"
