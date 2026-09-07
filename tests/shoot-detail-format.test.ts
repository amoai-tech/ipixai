import { describe, expect, it } from "vitest";

import {
  formatBudget,
  formatChannelList,
  formatCountLabel,
  formatDateRange,
  formatDnaScore,
} from "@/components/shoot/shoot-detail-format";

describe("IPI-1067 · SHOOT-001 — formatDateRange", () => {
  it("renders date-only values as calendar dates, stable under a negative timezone offset", () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatDateRange("2026-09-12", "2026-09-14")).toBe("Sep 12 – 14, 2026");
      expect(formatDateRange("2026-09-12", "2026-09-12")).toBe("Sep 12, 2026");
    } finally {
      process.env.TZ = previousTz;
    }
  });

  it("renders a single date and cross-month ranges", () => {
    expect(formatDateRange("2026-09-12", null)).toBe("Sep 12, 2026");
    expect(formatDateRange(null, "2026-09-14")).toBe("Sep 14, 2026");
    expect(formatDateRange("2026-09-30", "2026-10-02")).toBe("Sep 30, 2026 – Oct 2, 2026");
    expect(formatDateRange("2026-09-12", "2027-03-01")).toBe("Sep 12, 2026 – Mar 1, 2027");
  });

  it("returns 'Not scheduled' for null/empty values", () => {
    expect(formatDateRange(null, null)).toBe("Not scheduled");
    expect(formatDateRange("", "")).toBe("Not scheduled");
  });

  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(formatDateRange("2026-02-30", null)).toBe("Not scheduled");
  });
});

describe("IPI-1067 · SHOOT-001 — formatBudget", () => {
  it("formats known currencies", () => {
    expect(formatBudget(12500, "USD")).toBe("$12,500");
    expect(formatBudget(3200, "EUR")).toBe("€3,200");
  });

  it("returns 'Not set' for a null amount", () => {
    expect(formatBudget(null, "USD")).toBe("Not set");
  });

  it("falls back to USD for malformed currency codes instead of throwing", () => {
    expect(formatBudget(12500, "")).toBe("$12,500");
    expect(formatBudget(12500, "US")).toBe("$12,500");
    expect(formatBudget(12500, "US Dollars")).toBe("$12,500");
    expect(formatBudget(12500, null)).toBe("$12,500");
  });
});

describe("IPI-1067 · SHOOT-001 — formatChannelList", () => {
  it("maps enum values through the app's channel labels", () => {
    expect(formatChannelList(["instagram_feed", "tiktok"])).toBe("IG · TikTok");
    expect(formatChannelList(["instagram_story", "youtube", "website"])).toBe(
      "IG Story · YouTube · Website",
    );
  });

  it("returns 'No channels' for null/empty", () => {
    expect(formatChannelList(null)).toBe("No channels");
    expect(formatChannelList([])).toBe("No channels");
  });
});

describe("IPI-1067 · SHOOT-001 — formatDnaScore / formatCountLabel", () => {
  it("formats DNA scores", () => {
    expect(formatDnaScore(82)).toBe("82");
    expect(formatDnaScore(82.4)).toBe("82");
    expect(formatDnaScore(null)).toBe("Not scored");
  });

  it("pluralizes counts", () => {
    expect(formatCountLabel(3, "shot")).toBe("3 shots");
    expect(formatCountLabel(1, "shot")).toBe("1 shot");
    expect(formatCountLabel(0, "asset")).toBe("No assets yet");
  });
});