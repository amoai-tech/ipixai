export function resolveAiProvider(): "gemini" | "groq" | "openai" {
  const raw = (Deno.env.get("AI_PROVIDER") ?? "gemini").trim().toLowerCase();
  if (raw === "gemini" || raw === "groq" || raw === "openai") return raw;
  throw new Error(
    `AI_PROVIDER="${raw}" is invalid (expected gemini | groq | openai).`,
  );
}

function isEnvTruthyValue(
  raw: string | undefined,
  defaultValue = false,
): boolean {
  if (raw === undefined || raw.trim() === "") return defaultValue;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function parseBiDnaAiProvider(raw: string | undefined): "gemini" | "groq" {
  const provider = (raw ?? "gemini").trim().toLowerCase();
  if (provider === "gemini" || provider === "groq") return provider;
  if (provider === "openai") {
    throw new Error(
      'AI_PROVIDER="openai" is not wired for edge BI/DNA structured paths.',
    );
  }
  throw new Error(
    `AI_PROVIDER="${provider}" is invalid (expected gemini | groq).`,
  );
}

/**
 * Brand intelligence: Gemini only (IPI-1093 — Groq/Cloudflare Workers AI
 * support removed, unused; see the removal commit for the audit). An
 * explicit BI_PROVIDER or AI_PROVIDER naming a different provider now fails
 * closed instead of silently routing to a client that no longer exists.
 */
export function resolveBiProviderFromEnv(env: {
  aiProvider?: string;
  biUseGemini?: string;
  biProvider?: string;
}): "gemini" {
  // An explicit scoped BI_PROVIDER wins outright — including over a
  // non-Gemini global AI_PROVIDER used by other paths (e.g. DNA on Groq).
  // Only fall through to the legacy BI_USE_GEMINI/AI_PROVIDER checks when
  // BI_PROVIDER itself is unset.
  const explicit = (env.biProvider ?? "").trim().toLowerCase();
  if (explicit === "gemini") return "gemini";
  if (explicit) {
    throw new Error(
      `BI_PROVIDER="${explicit}" is invalid — Groq/Cloudflare Workers AI support was removed; only gemini is wired.`,
    );
  }
  if (isEnvTruthyValue(env.biUseGemini)) return "gemini";
  const aiProvider = (env.aiProvider ?? "gemini").trim().toLowerCase();
  if (aiProvider && aiProvider !== "gemini") {
    throw new Error(
      `AI_PROVIDER="${aiProvider}" is invalid for brand intelligence — Groq/Cloudflare Workers AI support was removed; only gemini is wired.`,
    );
  }
  return "gemini";
}

/** Brand intelligence: BI_PROVIDER/BI_USE_GEMINI/AI_PROVIDER must all name gemini or be unset. */
export function resolveBiProvider(): "gemini" {
  return resolveBiProviderFromEnv({
    aiProvider: Deno.env.get("AI_PROVIDER"),
    biUseGemini: Deno.env.get("BI_USE_GEMINI"),
    biProvider: Deno.env.get("BI_PROVIDER"),
  });
}

/**
 * DNA vision provider selection — unrelated to brand-intelligence (this is
 * for the separate, not-yet-reconciled-into-this-repo audit-asset-dna
 * function) and intentionally left untouched by the IPI-1093 Groq/Cloudflare
 * removal: defaults to Gemini today, but its "groq" branch is still the
 * intended eventual production choice pending a golden eval, not dead code
 * to remove alongside brand-intelligence's.
 */
export function resolveDnaProviderFromEnv(env: {
  aiProvider?: string;
  dnaUseGemini?: string;
}): "gemini" | "groq" {
  if (isEnvTruthyValue(env.dnaUseGemini, true)) return "gemini";
  return parseBiDnaAiProvider(env.aiProvider);
}

/** DNA vision: defaults to Gemini until golden eval (DNA_USE_GEMINI=1). */
export function resolveDnaProvider(): "gemini" | "groq" {
  return resolveDnaProviderFromEnv({
    aiProvider: Deno.env.get("AI_PROVIDER"),
    dnaUseGemini: Deno.env.get("DNA_USE_GEMINI"),
  });
}
