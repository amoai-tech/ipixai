# 02 — Identity + organizations

Status: Complete (read-only, 2026-09-01)
Score: 78/100
Verification confidence: 88/100
Tables inspected: `auth.users`, `public.profiles`, `public.organizations`, `public.org_members` (+ helper RPCs)
Code paths inspected: `src/lib/auth/verified-operator.ts`, `src/lib/auth/runtime-org.ts`, `src/app/api/copilotkit/[[...slug]]/route.ts`
Live queries: column/constraint/RLS `pg_get_expr`, membership role counts, orgs with zero members
Official references: [Supabase Auth](https://supabase.com/docs/guides/auth) (JWT `sub` = `auth.uid()`)

## Verdict

Tenant identity is the right shape: **JWT user → `org_members` row → one org at a time → `org:{orgId}::user:{userId}`**. CopilotKit **does not** trust client org hints or `user_metadata`. That is correct. Gaps: two leftover empty orgs; `profiles.role` is a **platform** enum (`admin` can mutate any org); profiles RLS still uses uncached `auth.uid()`; hosted Org A/B isolation is **not** proven in this step (PR #23 still open for thread ACL).

## Current state

Live counts: **2** `auth.users`, **2** `profiles`, **4** `organizations`, **3** `org_members` (2 owner + 1 editor). Two orgs have **zero** members (`ipi949-verify-*` leftovers). Named orgs: `acme`, `majji`, plus the two verify slugs.

### Relationships

```text
auth.users.id
    ├── profiles.id (1:1 expected; 2/2 populated)
    └── org_members.user_id  ON DELETE CASCADE
organizations.id
    └── org_members.org_id  ON DELETE CASCADE
        PK (org_id, user_id)
        CHECK role IN (owner, editor, viewer)
```

`organizations.owner_id` is nullable UUID (not verified as FK to `auth.users` in this query). Org delete/insert also allows `profiles.role = 'admin'`.

### RLS (authenticated)

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| organizations | `is_org_member(id)` OR `auth.uid() = owner_id` | owner_id = uid OR platform admin | owner or platform admin | owner_id = uid OR platform admin |
| org_members | `is_org_member(org_id)` | `is_org_owner(org_id)` only | owner | owner **or** self (`user_id = uid`) |
| profiles | own row `auth.uid() = id` | own id | own id | **no DELETE policy** |

Helpers `is_org_member` / `is_org_owner` / `is_org_editor_or_above` are **SECURITY DEFINER** with `search_path=public`.

### Frontend / backend wiring

| Step | Behavior | Verified |
| --- | --- | --- |
| Session | CopilotKit route: no operator → 401 | Code |
| Membership | `listMembershipOrgIds` reads `org_members` only; ignores client org + `user_metadata` | Code |
| 0 orgs | `needs_onboarding` → forbidden | Code |
| >1 org | `needs_org_selection` → forbidden (no multi-org switcher in this route) | Code |
| 1 org | `memoryResourceId` = `org:{orgId}::user:{userId}` | Code |
| Stop/run keys | `TenantAbortRunner` prefixes threadId with resourceId | Code |

**NOT VERIFIED here:** live browser login; hosted Org B 403; whether `createClientFromRequest` uses user JWT (assumed from AUTH-002 Done tickets).

### Cross-org access

- Members of org A cannot SELECT org B via `organizations_select` unless they are members or `owner_id`.
- Platform `profiles.role = admin` can UPDATE/DELETE any organization — **intentional superuser**, not tenant isolation.
- Self-leave: member can DELETE own `org_members` row.
- Cannot INSERT self onto another org (insert requires `is_org_owner`).
- Empty IPI-949 orgs are not joinable via JWT unless someone is `owner_id` or admin.

## What is correct

- Membership table is the SoT for CopilotKit tenant (AUTH-002).
- Composite PK + role CHECK + cascade to auth.users.
- DEFINER helpers pin `search_path`.
- Fail-closed on lookup error (`lookup_failed`).

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Hosted **Org A vs Org B** thread deny is **unproven** in this audit. Thread ACL is on **open PR #23**, not `main`. |
| P1 | Two **memberless** orgs leftover from IPI-949 verify — confuse QA; do not delete without a named cleanup task. |
| P2 | `profiles` policies use `auth.uid()` not `(SELECT auth.uid())` — initplan warning class; not a bypass by itself. |
| P2 | No `profiles` DELETE policy — rows can linger if auth user is deleted depending on FK (NOT VERIFIED FK on profiles.id). |
| P2 | Multi-membership users are blocked at CopilotKit (`needs_org_selection`) with no product UI in this repo path. |
| P3 | `organizations.owner_id` nullable vs `org_members` owner role — two owner concepts. |

## Fixes

- Keep membership-only resolution. Do not add client org headers.
- Prove hosted deny: **IPI-1125 · AUTH-QA-ORGS** + merge **PR #23** (ACCESS ACL).
- Optional: archive/hide IPI-949 empty orgs (ops, not a migration rewrite).
- Wrap `auth.uid()` in profiles RLS when touching that table next (**IPI-1039** classify, not a drive-by).

## Faster/better approach

Live policy text + three source files beat reconstructing from migrations. Did not run a second user’s JWT (would need secrets / test users).

## Production blockers

**CopilotKit on production** without proven Org B deny and without PR #23 is a **tenant-isolation** blocker, not an identity-schema blocker. Identity schema is usable.

## Existing Linear ownership

| Topic | Owner |
| --- | --- |
| Membership proof / no user_metadata | **IPI-1046 · AUTH-002** (Done — do not restart) |
| Signed-in /info | **IPI-1037 · AUTH-001** (Done) |
| Thread ACL | PR #23 / ACCESS track |
| QA orgs | **IPI-1125** |
| HIBP | **IPI-863** |

## Verification / success criteria

- [x] Live RLS predicates read
- [x] CopilotKit uses membership-only org
- [ ] Browser login → org resolve (NOT this step)
- [ ] Org B 403 on same threadId (NOT this step)

## ERD / data flow where useful

```text
Browser cookies
  → getVerifiedOperatorForRequest (JWT sub)
  → org_members WHERE user_id = sub
  → 1 orgId
  → resourceId org:{org}::user:{user}
  → Mastra Memory / CopilotKit runner keys
```

## Next step

**03 — RLS + database security** → `03-rls-security.md`
