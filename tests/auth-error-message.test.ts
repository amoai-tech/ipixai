import { describe, expect, it } from "vitest";

import { getAuthSubmitErrorMessage } from "../src/components/auth/auth-error-message";
import { SupabaseConfigError } from "../src/lib/supabase/client";

describe("getAuthSubmitErrorMessage", () => {
  it("distinguishes missing Supabase configuration from bad credentials", () => {
    const error = new SupabaseConfigError();

    expect(getAuthSubmitErrorMessage(error, "signin")).toBe(
      "Sign in is temporarily unavailable. Please try again shortly.",
    );
  });

  it("keeps ordinary sign-in failures generic", () => {
    expect(getAuthSubmitErrorMessage(new Error("Invalid login credentials"), "signin")).toBe(
      "Sign in failed",
    );
  });
});
