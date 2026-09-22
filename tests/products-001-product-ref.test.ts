import { describe, expect, it } from "vitest";

import { ProductRefSchema } from "../src/lib/commerce/product-ref";

const PRODUCT_ONLY = {
  provider: "catalog",
  providerProductId: "product-123",
  title: "Black Dress",
};

const PRODUCT_VARIANT = {
  provider: "catalog",
  providerProductId: "product-123",
  providerVariantId: "variant-size-m",
  title: "Black Dress",
  variantTitle: "Size M",
  sku: "DRESS-BLK-M",
  imageUrl: "https://example.com/dress.jpg",
};

describe("IPI-1165 · ProductRefSchema", () => {
  it("parses a product-only reference", () => {
    expect(ProductRefSchema.parse(PRODUCT_ONLY)).toEqual(PRODUCT_ONLY);
  });

  it("parses a product+variant reference without rewriting identity", () => {
    expect(ProductRefSchema.parse(PRODUCT_VARIANT)).toEqual(PRODUCT_VARIANT);
  });

  it.each([
    [{ ...PRODUCT_ONLY, provider: undefined }, "provider"],
    [{ ...PRODUCT_ONLY, providerProductId: undefined }, "providerProductId"],
  ])("rejects a missing identity field: %s", (candidate, _field) => {
    expect(ProductRefSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, internalId: "do-not-accept" }).success).toBe(false);
  });
});
