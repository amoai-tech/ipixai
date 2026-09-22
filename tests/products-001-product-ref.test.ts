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
    [{ ...PRODUCT_ONLY, title: undefined }, "title"],
  ])("rejects a missing required field: %s", (candidate, _field) => {
    expect(ProductRefSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    ["provider", { provider: "x".repeat(2001) }],
    ["providerProductId", { providerProductId: "x".repeat(2001) }],
    ["providerVariantId", { providerVariantId: "x".repeat(2001) }],
    ["title", { title: "x".repeat(2001) }],
    ["variantTitle", { variantTitle: "x".repeat(2001) }],
    ["sku", { sku: "x".repeat(2001) }],
    ["imageUrl", { imageUrl: `https://example.com/${"x".repeat(2000)}` }],
  ])("rejects an oversized %s", (_field, patch) => {
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, ...patch }).success).toBe(false);
  });

  it.each([
    ["providerVariantId", { providerVariantId: "" }],
    ["variantTitle", { variantTitle: "" }],
    ["sku", { sku: "" }],
  ])("rejects an empty optional string when %s is present", (_field, patch) => {
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, ...patch }).success).toBe(false);
  });

  it("validates imageUrl format when present", () => {
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, imageUrl: "not-a-url" }).success).toBe(false);
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, imageUrl: "https://example.com/image.jpg" }).success).toBe(true);
  });

  it("rejects unexpected fields", () => {
    expect(ProductRefSchema.safeParse({ ...PRODUCT_ONLY, internalId: "do-not-accept" }).success).toBe(false);
  });
});
