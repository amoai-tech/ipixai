import { redirect } from "next/navigation";

// IPI-1225 · PLANNER-ROUTE-RETIRE-001 — /app is now the single production
// Planner surface; /planner is only a compatibility redirect. Auth/tenant
// gating (login, onboarding, membership-conflict fail-closed) is owned once
// by /app's own layout (src/app/app/layout.tsx via requireResolvedAppWorkspace
// in src/lib/auth/app-shell.ts) — duplicating those checks here would let
// the two gates silently diverge.
export default async function Page() {
  redirect("/app");
}