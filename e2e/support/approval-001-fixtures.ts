/**
 * IPI-1084 · APPROVAL-001 — PR 2b browser-proof fixture constants.
 *
 * Mirror of the fixture SQL/ids in `scripts/run-approval-001-e2e.mjs` (the
 * seeding source of truth). Change both together: the spec signs in with these
 * credentials and reads the brand by id, so any drift fails loudly on the first
 * request instead of silently passing.
 *
 * These accounts exist only in a local `supabase start` database. The hosted QA
 * environment has two isolated owners with zero brands and no viewer
 * membership, which cannot express "Org A editor allowed / Org A viewer denied
 * / Org B denied"; provisioning a viewer there would mean writing users into a
 * hosted project. See `scripts/run-approval-001-e2e.mjs`, which refuses any
 * non-loopback database.
 */

export const LOCAL_E2E_PASSWORD = "ipi1084-local-e2e-password";

/**
 * Org A's owner exists so the organization stays well-formed. It is deliberately
 * NOT the positive browser actor: `is_org_editor_or_above` accepts owner OR
 * editor, so the editor — not the owner — must be the actor that proves a
 * review can be started and decided.
 */
export const ORG_A_OWNER = {
  email: "ipi1084-owner-a@ipix.test",
  userId: "10840000-0000-4000-8000-000000000004",
  orgId: "10840000-0000-4000-8000-00000000000a",
  role: "owner",
} as const;

export const ORG_A_EDITOR = {
  email: "ipi1084-editor-a@ipix.test",
  userId: "10840000-0000-4000-8000-000000000001",
  orgId: ORG_A_OWNER.orgId,
  /** Enforced by the DB fixture and re-asserted by the spec before any decision. */
  role: "editor",
  brandId: "10840000-0000-4000-8000-0000000000aa",
} as const;

export const ORG_A_VIEWER = {
  email: "ipi1084-viewer-a@ipix.test",
  userId: "10840000-0000-4000-8000-000000000002",
  orgId: ORG_A_EDITOR.orgId,
  role: "viewer",
} as const;

export const ORG_B_OWNER = {
  email: "ipi1084-orgb@ipix.test",
  userId: "10840000-0000-4000-8000-000000000003",
  orgId: "10840000-0000-4000-8000-00000000000b",
  brandId: "10840000-0000-4000-8000-0000000000bb",
} as const;

/**
 * A canonical-enough ShootPlan: the review lifecycle stages and hashes whatever
 * object it is given, so this only needs the fields the review surface reads.
 */
export const REVIEW_PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
  referencesUsed: [{ id: "ref-front", angle: "Full body front" }],
  shotListResult: {
    shots: [
      {
        shotNumber: 1,
        description: "Hero front",
        angle: "Full body front",
        referenceId: "ref-front",
      },
    ],
  },
  risks: ["Talent availability"],
  missingInputs: [],
} as const;

/** A distinguishable edited revision used to prove edit-invalidation. */
export const EDITED_REVIEW_PLAN = {
  ...REVIEW_PLAN,
  objective: { value: "Launch the spring capsule (edited)", status: "confirmed" },
  referencesUsed: [{ id: "ref-side", angle: "Full body side" }],
  shotListResult: {
    shots: [
      {
        shotNumber: 1,
        description: "Hero side",
        angle: "Full body side",
        referenceId: "ref-side",
      },
    ],
  },
} as const;
