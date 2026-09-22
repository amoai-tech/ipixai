# Cloudinary

Cloudinary owns image/video bytes, transformations, provider media identity, and delivery. Supabase owns iPix business truth: organization, brand, shoot, campaign links, approval, workflow state, actor, and audit history.

## Start here

| Need                           | Current source                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Media architecture / phase map | [prd.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/prd.md)                                                           |
| Core secure media foundation   | [cloudinary-core-prd.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/cloudinary-core-prd.md)                           |
| MVP operator media journey     | [cloudinary-mvp-prd.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/cloudinary-mvp-prd.md)                             |
| Advanced reuse/search/AI       | [cloudinary-advanced-prd.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/cloudinary-advanced-prd.md)                   |
| Exact external reuse plan      | [reuse.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/reuse.md)                                                       |
| Production/recovery runbook    | [operations.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/operations.md)                                             |
| Locked provider contract       | [CONTRACT-1110-1112.lock.md](../../docs/ipix-platform/docs/ipix-platform/04-cloudinary/CONTRACT-1110-1112.lock.md)                   |
| Master product requirements    | [../PRD.md](../prd.md)                                                                                                               |
| Live task status               | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues)                                                      |
| Historical corrected audit     | [archive/cloudinary/audit-2026-09-02.md](https://github.com/amoai-tech/ipixai/blob/main/docs/archive/cloudinary/audit-2026-09-02.md) |

## Phase model

```
Core: secure signed upload + webhook + protected delivery
→ MVP: Shoot upload + QA/DNA evidence + exact-version human approval
→ Advanced: approved-media reuse + optional metadata/search/AI/video
→ Operations: controlled production rollout, recovery, and certification
```

## Rules

* Prefer existing iPix code and official Cloudinary SDKs/components/examples before custom media infrastructure.
* Browser uploads are authorized and signed server-side; secrets never go to the client.
* Webhooks verify provider authenticity before writing business state.
* Protected delivery is authorized from Supabase tenant/business truth first.
* Cloudinary metadata/search may enrich media; they do not replace org/shoot/campaign/approval truth in Supabase.
* AI analysis proposes evidence; humans approve consequential media state.
* Phase PRDs contain useful detailed requirements but include dated snapshots. Re-verify package versions, Linear status, provider plan/limits, and live configuration before implementation.
* Current execution sequencing belongs in Linear, not archived TODO/roadmap files.
