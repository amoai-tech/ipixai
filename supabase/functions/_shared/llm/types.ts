// IPI-1093 · BRAND-INTEL-001 — reconstructed, not fetched from source of truth
// (see git history for the original full reconstruction note). Narrowed
// further by the IPI-1093 Groq/Cloudflare-removal follow-up: GroqRateLimitHeaders,
// GroqModelEntry, and GroqModelsConfig were only ever consumed by
// groq-client.ts/retry.ts/allowlist.ts's Groq model registry, all deleted —
// removed alongside them rather than left as unused exported types.
//
// AiProvider keeps "groq" as a possible value: resolveDnaProviderFromEnv
// (allowlist.ts) still legitimately returns it for the separate,
// not-yet-reconciled-into-this-repo DNA vision function — narrowing it to
// "gemini" only would be a type error there, not a real simplification.

export type AiProvider = "gemini" | "groq";

export type StructuredGenerationScope = "default" | "bi";

export type StructuredGenerationOptions = {
  systemPrompt: string;
  userContent: string;
  jsonSchema: Record<string, unknown>;
  geminiResponseSchema?: object;
  temperature?: number;
  timeoutMs?: number;
  scope?: StructuredGenerationScope;
};

export type StructuredGenerationUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type StructuredGenerationLog = {
  provider: AiProvider;
  model: string;
  schemaRepairCount: number;
  usage?: StructuredGenerationUsage;
};

export type StructuredGenerationResult<T> = {
  data: T;
  text: string;
  log: StructuredGenerationLog;
};
