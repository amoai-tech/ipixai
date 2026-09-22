import { z } from "zod";

/**
 * IPI-1165 · PRODUCTS-001 — canonical external product/variant identity.
 *
 * provider + providerProductId + providerVariantId are identity.
 * The remaining fields are display snapshots only and must never replace
 * stable provider identifiers when those identifiers are available.
 */
export const ProductRefSchema = z
  .object({
    provider: z.string().min(1),
    providerProductId: z.string().min(1),
    providerVariantId: z.string().min(1).nullable().optional(),
    title: z.string().min(1),
    variantTitle: z.string().nullable().optional(),
    sku: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type ProductRef = z.infer<typeof ProductRefSchema>;
