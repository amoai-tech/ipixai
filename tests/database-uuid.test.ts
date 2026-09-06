import { describe, expect, it } from "vitest";

import { isDatabaseUuid } from "../src/lib/database-uuid";

describe("database UUID contract", () => {
  it("accepts canonical PostgreSQL UUID text regardless of UUID version bits", () => {
    expect(isDatabaseUuid("00000000-0000-0000-0000-000000000001")).toBe(true);
    expect(isDatabaseUuid("db1f728d-bee1-430e-a3e7-0c601da74ce7")).toBe(true);
    expect(isDatabaseUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(true);
  });

  it("rejects malformed UUID text", () => {
    for (const value of [
      "",
      "foo",
      "123",
      "undefined",
      "00000000",
      "zzzzzzzz-0000-0000-0000-000000000001",
      "000000000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-00000000001",
    ]) {
      expect(isDatabaseUuid(value)).toBe(false);
    }
  });
});
