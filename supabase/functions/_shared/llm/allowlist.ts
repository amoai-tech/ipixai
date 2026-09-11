import type { GroqModelsConfig } from "./types.ts";

import groqModelsJson from "../../../../config/groq-models.json" with {
  type: "json",
};

export const groqModelsConfig = groqModelsJson as GroqModelsConfig;

const MODEL_BY_ID = new Map(
  groqModelsConfig.models.map((entry) => [entry.id, entry] as const),
);

export function getGroqModelEntry(modelId: string) {
  return MODEL_BY_ID.get(modelId);
}

export function resolveGroqModelId(
  tier: keyof GroqModelsConfig["defaults"] = "default",
): string {
  const envKey = groqModelsConfig.envMapping[tier];
  const fromEnv = envKey ? Deno.env.get(envKey)?.trim() : "";
  const fallback = groqModelsConfig.defaults[tier]?.trim() ?? "";
  const modelId = fromEnv || fallback;
  if (!modelId) {
    throw new Error(`No Groq model configured for tier "${tier}".`);
  }
  if (!MODEL_BY_ID.has(modelId)) {
    throw new Error(
      `Groq model "${modelId}" is not in config/groq-models.json allowlist.`,
    );
  }
  return modelId;
}

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

export function resolveBiProviderFromEnv(env: {
  aiProvider?: string;
  biUseGemini?: string;
  biProvider?: string;
}): "gemini" | "groq" | "workers-ai" {
  // BI_PROVIDER is a scoped override for this call site only — it never
  // touches the global AI_PROVIDER, so DNA and other structured-generation
  // flows are unaffected by a brand-intelligence provider change (IPI-741).
  const explicit = (env.biProvider ?? "").trim().toLowerCase();
  if (explicit === "cloudflare" || explicit === "workers-ai") return "workers-ai";
  if (explicit === "gemini" || explicit === "groq") return explicit;
  if (explicit) {
    throw new Error(
      `BI_PROVIDER="${explicit}" is invalid (expected cloudflare | gemini | groq).`,
    );
  }
  if (isEnvTruthyValue(env.biUseGemini)) return "gemini";
  return parseBiDnaAiProvider(env.aiProvider);
}

/** Brand intelligence: BI_PROVIDER overrides everything; else BI_USE_GEMINI=1 forces Gemini; else AI_PROVIDER. */
export function resolveBiProvider(): "gemini" | "groq" | "workers-ai" {
  return resolveBiProviderFromEnv({
    aiProvider: Deno.env.get("AI_PROVIDER"),
    biUseGemini: Deno.env.get("BI_USE_GEMINI"),
    biProvider: Deno.env.get("BI_PROVIDER"),
  });
}

/** Workers AI model called through the ipix-prod AI Gateway (IPI-741). */
export function resolveCloudflareModel(): string {
  return (
    Deno.env.get("CLOUDFLARE_AI_MODEL")?.trim() ||
    "@cf/meta/llama-4-scout-17b-16e-instruct"
  );
}

/** ipix-prod (or override) — the named AI Gateway this account routes Workers AI through. */
export function resolveCloudflareGatewayId(): string {
  return Deno.env.get("CLOUDFLARE_AI_GATEWAY_ID")?.trim() || "ipix-prod";
}

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
