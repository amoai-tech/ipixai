---
name: supabase-review
description: Review iPix Supabase/Auth/Postgres changes for RLS, grants, RPC, migration, tenant-isolation, and data-integrity regressions.
metadata:
  owner: IPI-1246
  impact: HIGH
---

# iPix Supabase PR Review

Source order: changed code/tests → current migrations/types → `.claude/skills/ipix-supabase/SKILL.md` → installed Supabase packages → official docs.

Material invariants:
- Browser `orgId`, `user_metadata`, and service-role possession are never authorization.
- RLS and SQL grants are separate gates; verify both.
- UPDATE ownership needs correct `USING`, `WITH CHECK`, and SELECT visibility.
- SECURITY DEFINER requires explicit need, safe `search_path`, qualified references, narrow ACLs, and tenant proof.
- Public/API views require intentional exposure, normally `security_invoker=true` or revoked access.
- Migration history is forward-only; do not rewrite applied history.
- DB errors must not be silently converted to “not found”.
- Tenant-sensitive changes require Org A allowed + Org B denied deterministic proof.

Do not invent production state. Live DB observations are evidence only when independently retrieved and identified by project/schema.
