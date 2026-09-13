import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

export class SupabaseConfigError extends Error {
  constructor() {
    super("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    this.name = "SupabaseConfigError";
  }
}

export function createClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new SupabaseConfigError();
  }
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
