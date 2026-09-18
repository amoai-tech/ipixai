# Data / Supabase pack

Studio **ledger** (tables, RLS, migrations, Mastra memory). Product PRD is [../prd.md](../../prd.md). Status is **Linear**.

Hosted: `nvdlhrodvevgwdsneplk`. Repo: [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai). No production writes from docs work.

| Job | File |
| --- | --- |
| What we are building | **[prd.md](./prd.md)** |
| Now / Next / Later | **[roadmap.md](./roadmap.md)** |
| Execution order | **[tasks.md](./tasks.md)** |
| Check-off + mint | **[todo.md](./todo.md)** |
| Live 01–20 audit | **[audit/00-audit-master.md](./audit/00-audit-master.md)** |
| Concise verdict (recheck) | **[audit/23-audit-supa.md](./audit/23-audit-supa.md)** — **67/100** ready · **87/100** architecture |
| DEFINER bodies | **[audit/24-security-definer-deep-audit.md](./audit/24-security-definer-deep-audit.md)** |
| Code → DB map | **[audit/25-code-database-dependency-map.md](./audit/25-code-database-dependency-map.md)** |
| Fix order (Linear) | **[audit/21-fix-plan.md](./audit/21-fix-plan.md)** |
| Fix order (schema → wiring) | **[audit/22-fix-plan.md](./audit/22-fix-plan.md)** |
| Forward-migration runbook | [supabase/ipi-1040-forward-migrations.md](../../data/supabase/ipi-1040-forward-migrations.md) |
| Advisor register | [supabase/security-advisor-register.md](../../data/supabase/security-advisor-register.md) |
| Master product | [../prd.md](../../prd.md) · [../roadmap.md](../../roadmap.md) |
| Media bytes | [../cloudinary/](../../cloudinary) |

**Today:** production readiness **67/100**. PR #23 is **CONFLICTING** — rebase, do not merge. Fingerprint Core tables **compatible** with `@mastra/pg@1.22.2`. Unlicensed Stop tests **59 passed**. Licensed CopilotKit runner still unproven. HIBP still OFF. Agent is still **weather-agent**.

**Next:** rebase PR #23 · licensed Stop test (**IPI-1009**) · **IPI-1124** recycle · **IPI-863** HIBP. DEFINER negatives still on **24**.

Dumps (`00`–`11`, old progress, prompts) still sit here until a **separate** archive PR → [../archive/](..). Do not replay them as SQL.
