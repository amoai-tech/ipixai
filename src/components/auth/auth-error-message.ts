import { SupabaseConfigError } from "@/lib/supabase/client";

export function getAuthSubmitErrorMessage(
  error: unknown,
  mode: "signin" | "signup",
): string {
  if (error instanceof SupabaseConfigError) {
    return mode === "signin"
      ? "Sign in is temporarily unavailable. Please try again shortly."
      : "Sign up is temporarily unavailable. Please try again shortly.";
  }

  return mode === "signin" ? "Sign in failed" : "Sign up failed";
}
