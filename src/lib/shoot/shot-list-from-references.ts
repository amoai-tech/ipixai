/**
 * IPI-1049 · TOOL-001 — pure shot-list construction. Adapted from Lumina
 * (amoai-tech/luminaai@main, app/src/lib/shoot/shot-list-from-references.ts).
 *
 * Renamed per this task's Correction 1/2 (do not imply formal approval, keep
 * the trusted-reference input name explicit): `approvedDeliverables` →
 * `selectedDeliverables`, `reference_shot_types` → `trustedReferenceShotTypes`.
 * Behavior otherwise unchanged: never invent a shot angle, every shot keeps
 * its source reference id, uncovered deliverables come back as warnings
 * rather than silently dropped.
 */

export type TrustedReferenceShotType = {
  id: string;
  angle: string;
  description: string;
  channelFit: string[];
  background?: string | null;
  category?: string | null;
  subcategory?: string | null;
  modelType?: string | null;
  tags?: string[] | null;
};

/**
 * Optional operator-known context used to rank references by semantic
 * compatibility. Every field is optional; a missing value is "unknown" and
 * must never filter a reference out (that would fabricate a gap) or
 * manufacture a match (that would fabricate compatibility).
 */
export type ReferenceSelectionContext = {
  productCategory?: string;
  modelType?: string;
  styleKeywords?: string[];
};

export type SelectedDeliverable = {
  id?: string;
  channel: string;
  format?: string;
  quantity: number;
};

export type BuiltShot = {
  shotNumber: number;
  description: string;
  angle: string;
  lighting: string;
  deliverableIds: string[];
  notes?: string;
  referenceId: string;
};

/** Wizard channel ids → shot_type_references.channel_fit values (Lumina naming preserved — same reference-library contract). */
export function toReferenceChannel(channel: string): string {
  return channel === "shopify" ? "shopify_pdp" : channel;
}

export function channelMatchesReference(deliverableChannel: string, channelFit: string[]): boolean {
  const refChannel = toReferenceChannel(deliverableChannel);
  return channelFit.includes(deliverableChannel) || channelFit.includes(refChannel);
}

function lightingFromBackground(background: string | null | undefined): string {
  if (!background) return "studio strobe";
  if (background === "white") return "even studio light";
  if (background === "lifestyle") return "natural window light";
  if (background === "custom_backdrop") return "styled key light";
  if (background === "studio_gradient") return "studio strobe with gradient";
  return "studio strobe";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalized metadata or `null` when it is absent OR whitespace-only.
 * Whitespace-only values must behave exactly like a missing column: they are
 * "unknown" (skip the field) rather than a value that mismatches and
 * disqualifies an otherwise compatible reference.
 */
function normalizedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalize(value);
  return normalized.length > 0 ? normalized : null;
}

/**
 * The ONE deterministic compatibility score for a trusted reference against a
 * deliverable channel plus whatever operator context is known.
 *
 * `0` means incompatible — the reference is never selected. Positive scores
 * rank compatible references; ties break on a stable key below, so the same
 * input always selects the same references regardless of database row order.
 *
 * Fail-closed rule: when operator context AND the reference both state a
 * field and the values differ, the reference is incompatible (`0`) — a
 * clothing request must not fall back to a beauty reference just because
 * their channels match. When either side is unknown the field is skipped:
 * the reference stays eligible but earns no compatibility credit, so an
 * unknown-metadata row can never outrank a known matching one.
 */
export function scoreReferenceCompatibility(
  reference: TrustedReferenceShotType,
  deliverableChannel: string,
  context: ReferenceSelectionContext = {},
): number {
  if (!channelMatchesReference(deliverableChannel, reference.channelFit)) return 0;

  let score = 1;

  const contextCategory = normalizedOrNull(context.productCategory);
  const referenceCategory = normalizedOrNull(reference.category);
  if (contextCategory && referenceCategory) {
    if (contextCategory !== referenceCategory) return 0;
    score += 4;
  }

  const contextModelType = normalizedOrNull(context.modelType);
  const referenceModelType = normalizedOrNull(reference.modelType);
  if (contextModelType && referenceModelType) {
    if (contextModelType !== referenceModelType) return 0;
    score += 2;
  }

  if (context.styleKeywords?.length && reference.tags?.length) {
    const refTags = new Set(reference.tags.map(normalize).filter((tag) => tag.length > 0));
    // De-duplicate the request's keywords too: repeating one keyword must not
    // inflate the overlap (["catalog","catalog"] scores the same as ["catalog"]).
    const styleTags = new Set(
      context.styleKeywords.map(normalize).filter((keyword) => keyword.length > 0),
    );
    let overlap = 0;
    for (const keyword of styleTags) {
      if (refTags.has(keyword)) overlap += 1;
    }
    // Style/tag agreement only adds credit; no overlap is not proof of
    // incompatibility, so it never removes the reference.
    score += Math.min(overlap, 2);
  }

  return score;
}

/** Total, locale-independent ordering key — `id` is unique, so every tie is broken. */
function stableReferenceKey(reference: TrustedReferenceShotType): string {
  return [reference.category, reference.subcategory, reference.angle, reference.id]
    .map((value) => value ?? "")
    .join("\u0000");
}

function compareRanked(
  a: { reference: TrustedReferenceShotType; score: number },
  b: { reference: TrustedReferenceShotType; score: number },
): number {
  if (a.score !== b.score) return b.score - a.score;
  const keyA = stableReferenceKey(a.reference);
  const keyB = stableReferenceKey(b.reference);
  if (keyA < keyB) return -1;
  if (keyA > keyB) return 1;
  return 0;
}

/**
 * Deterministic, compatibility-aware reference selection. Replaces the
 * previous channel-only "first rows win" behavior: the same references and
 * the same context always yield the same picks, and known-incompatible
 * references are excluded rather than silently substituted.
 */
export function pickReferencesForDeliverable(
  deliverableChannel: string,
  references: TrustedReferenceShotType[],
  count: number,
  context: ReferenceSelectionContext = {},
): TrustedReferenceShotType[] {
  const ranked = references
    .map((reference) => ({
      reference,
      score: scoreReferenceCompatibility(reference, deliverableChannel, context),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(compareRanked);
  if (!ranked.length) return [];
  const picked: TrustedReferenceShotType[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(ranked[i % ranked.length].reference);
  }
  return picked;
}

/**
 * Throws only on a genuinely invented reference id (a real bug, not a
 * business-input gap) — empty trustedReferenceShotTypes is validated by the
 * tool's Zod schema (`.min(1)`) before this helper ever runs.
 */
export function buildShotListFromReferences(
  selectedDeliverables: SelectedDeliverable[],
  trustedReferenceShotTypes: TrustedReferenceShotType[],
  productNames: string[] = [],
  selectionContext: ReferenceSelectionContext = {},
): { shots: BuiltShot[]; uncoveredDeliverableWarnings: string[] } {
  const allowedReferenceIds = new Set(trustedReferenceShotTypes.map((r) => r.id));
  let shotCounter = 0;
  const shots: BuiltShot[] = [];
  // Coverage is tracked by array position, not by `id` — a caller-supplied
  // (or fallback-generated) id can collide across deliverables, which would
  // otherwise make one deliverable's shots incorrectly cover another's.
  const uncoveredDeliverableWarnings: string[] = [];

  for (let di = 0; di < selectedDeliverables.length; di++) {
    const deliverable = selectedDeliverables[di];
    const deliverableId = deliverable.id ?? `deliverable-${di}`;
    const shotCount = Math.max(1, Math.ceil(deliverable.quantity / 3));
    const refs = pickReferencesForDeliverable(
      deliverable.channel,
      trustedReferenceShotTypes,
      shotCount,
      selectionContext,
    );

    if (refs.length === 0) {
      uncoveredDeliverableWarnings.push(
        `Deliverable ${deliverable.channel}/${deliverable.format ?? ""} has no shots — no trusted reference is compatible with this channel and the known product context`,
      );
      continue;
    }

    // Cycle product names across deliverables in order rather than always
    // using productNames[0] — with one name every shot still gets it, with
    // several each deliverable's shots get their own instead of discarding
    // every name after the first.
    const productName = productNames.length > 0 ? productNames[di % productNames.length] : undefined;

    for (const ref of refs) {
      if (!allowedReferenceIds.has(ref.id)) {
        throw new Error(`Invented reference id "${ref.id}" — references must come from trustedReferenceShotTypes`);
      }
      shots.push({
        shotNumber: ++shotCounter,
        description: `${deliverable.channel} ${deliverable.format ?? ""} — ${ref.description}`.trim(),
        angle: ref.angle,
        lighting: lightingFromBackground(ref.background),
        deliverableIds: [deliverableId],
        referenceId: ref.id,
        notes: productName ? `Product: ${productName}` : undefined,
      });
    }
  }

  return { shots, uncoveredDeliverableWarnings };
}
