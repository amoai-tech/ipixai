import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
