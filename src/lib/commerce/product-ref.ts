import { z } from "zod";

// Product identity arrays are bounded independently from descriptive productNames (50).
// A shoot can legitimately carry more exact product/variant refs than display-name hints.
export const MAX_PRODUCT_REFS = 100;
// Defensive transport/schema ceiling aligned with iPix Planner's existing 2,000-char
// free-text ceiling. This is an iPix safety bound, not a provider-specific API limit.
export const MAX_PRODUCT_REF_TEXT_LENGTH = 2000;

/**
 * IPI-1165 · PRODUCTS-001 — canonical external product/variant identity.
 *
 * provider + providerProductId + providerVariantId are identity.
 * The remaining fields are display snapshots only and must never replace
 * stable provider identifiers when those identifiers are available.
 */
export const ProductRefSchema = z
  .object({
    provider: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH),
    providerProductId: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH),
    providerVariantId: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
    title: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH),
    variantTitle: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
    sku: z.string().min(1).max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
    imageUrl: z.string().url().max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
  })
  .strict();

export type ProductRef = z.infer<typeof ProductRefSchema>;
