import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const MIGRATION = new URL(
  "../supabase/migrations/20260922090000_ipi1083_save_approved_shoot_once.sql",
  import.meta.url,
);

async function sql(): Promise<string> {
  return readFile(MIGRATION, "utf8");
}

describe("IPI-1083 · SHOOT-SAVE-001", () => {
  it("accepts only an approval locator and derives actor/plan authority in Postgres", async () => {
    const migration = await sql();
    expect(migration).toContain("create or replace function public.save_approved_shoot(p_approval_id uuid)");
    expect(migration).toContain("v_actor uuid := (select auth.uid())");
    expect(migration).not.toMatch(/p_(org|actor|plan_hash|plan|brand_id|created_by)/);
  });

  it("binds one approval to one durable shoot with complete provenance", async () => {
    const migration = await sql();
    expect(migration).toContain("approval_id uuid");
    expect(migration).toContain("approval_revision integer");
    expect(migration).toContain("approval_plan_hash text");
    expect(migration).toContain("approved_plan jsonb");
    expect(migration).toContain("unique (approval_id)");
  });

  it("revalidates exact approval truth before any shoot write", async () => {
    const migration = await sql();
    expect(migration).toContain("v_recomputed_hash := encode(extensions.digest(v_approval.plan::text, 'sha256'), 'hex')");
    expect(migration).toContain("v_approval.status is distinct from 'approved'");
    expect(migration).toContain("newer.revision > v_approval.revision");
    expect(migration).toContain("public.is_org_editor_or_above(b.org_id)");
    expect(migration.indexOf("insert into shoot.shoots")).toBeGreaterThan(migration.indexOf("HASH_MISMATCH"));
  });

  it("persists normalized children without dropping trusted reference provenance", async () => {
    const migration = await sql();
    expect(migration).toContain("insert into shoot.shoot_deliverables");
    expect(migration).toContain("insert into shoot.shot_list");
    expect(migration).toContain("reference_id");
    expect(migration).toContain("insert into shoot.shot_deliverable_links");
    expect(migration).toContain("approved_plan");
  });

  it("is least-privilege and safe by construction", async () => {
    const migration = await sql();
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("revoke all on function public.save_approved_shoot(uuid) from public, anon, service_role;");
    expect(migration).toContain("grant execute on function public.save_approved_shoot(uuid) to authenticated;");
  });
});
