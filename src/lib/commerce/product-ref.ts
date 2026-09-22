import { z } from "zod";

export const MAX_PRODUCT_REFS = 100;
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
    variantTitle: z.string().max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
    sku: z.string().max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
    imageUrl: z.string().url().max(MAX_PRODUCT_REF_TEXT_LENGTH).nullable().optional(),
  })
  .strict();

export type ProductRef = z.infer<typeof ProductRefSchema>;
