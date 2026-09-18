import { redirect } from "next/navigation";

import { getVerifiedOperatorFromCookies } from "./operator-auth";
import { postAuthDestinationFor } from "./post-auth-destination";
import { listMembershipOrgIdsFromServerClient } from "./runtime-org";
import { createClient } from "@/lib/supabase/server";

/**
 * IPI-1157 · AUTH-UX-001 — shared already-authenticated guard for /login and
 * /signup (extracted after review on PR #79 flagged the two page bodies as
 * near-identical duplicates of operator lookup, Supabase client creation,
 * and destination resolution).
 *
 * `currentRoute` preserves each page's own "don't redirect to myself"
 * semantics: /login's fail-closed destination IS "/login", so it must not
 * loop; postAuthDestinationFor never returns "/signup", so this always
 * redirects an authenticated visitor away from /signup.
 */
export async function redirectIfAlreadyAuthenticated(
  currentRoute: "/login" | "/signup",
): Promise<void> {
  const operator = await getVerifiedOperatorFromCookies();
  if (!operator) return;
  const supabase = await createClient();
  // supabase null (env missing) → render the form; unknown tenant state
  // never grants access and never redirects into a post-auth loop.
  if (!supabase) return;
  const destination = await postAuthDestinationFor({
    operator,
    listOrgIds: () => listMembershipOrgIdsFromServerClient(supabase, operator.id),
  });
  if (destination !== currentRoute) {
    redirect(destination);
  }
}
