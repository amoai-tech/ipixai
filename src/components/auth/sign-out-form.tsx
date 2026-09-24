import { Button } from "@/components/ui/button";

/**
 * IPI-1157 · AUTH-UX-001 — shared server-action Sign out control.
 *
 * Extracted verbatim from the working pattern in
 * operator-panel.tsx (`<form action="/auth/sign-out" method="post">`), reused
 * here for the authenticated boundary pages (/onboarding) that had no exit
 * before this task. Posts to the existing src/app/auth/sign-out/route.ts —
 * no new Supabase call, no new route.
 */
export function SignOutForm({ className }: { className?: string }) {
  return (
    <form action="/auth/sign-out" method="post" className={className}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
