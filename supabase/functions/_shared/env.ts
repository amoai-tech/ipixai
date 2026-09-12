export type EdgeEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function parseKeyFromJson(envName: string, field = "default"): string | null {
  const raw = Deno.env.get(envName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[field] ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required edge env: ${name}`);
  }
  return value;
}

function resolveAnonKey(): string {
  return (
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_OR_ANON_KEY") ??
    parseKeyFromJson("SUPABASE_PUBLISHABLE_KEYS") ??
    (() => {
      throw new Error(
        "Missing anon key (SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_OR_ANON_KEY)",
      );
    })()
  );
}

function resolveServiceRoleKey(): string {
  // Trimmed once here, not at each comparison site: resolve-caller.ts
  // compares this against a trimmed Authorization header token
  // (`header.slice(7).trim()`) — an untrimmed secret (trailing newline from
  // a copy-paste into secret storage, common in practice) would silently
  // reject every legitimate service-role caller, including the ones this
  // PR's blocker #3 fix now relies on as the *only* accepted caller.
  const raw =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    parseKeyFromJson("SUPABASE_SECRET_KEYS") ??
    (() => {
      throw new Error(
        "Missing service role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS)",
      );
    })();
  return raw.trim();
}

/** Validate Supabase-injected env vars once per cold start. */
export function getEdgeEnv(): EdgeEnv {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    anonKey: resolveAnonKey(),
    serviceRoleKey: resolveServiceRoleKey(),
  };
}

/** Optional secrets for future AI/media agents — not required for PLT-003 foundation. */
export function getOptionalSecret(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : undefined;
}
