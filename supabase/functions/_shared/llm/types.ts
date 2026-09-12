// IPI-1093 · BRAND-INTEL-001 — reconstructed, not fetched from source of truth.
//
// This module is imported only as `import type { ... } from "./types.ts"` across
// groq-client.ts, retry.ts, allowlist.ts, structured.ts, and
// brand-intelligence/handler.ts. Type-only imports are fully erased by esbuild
// before Supabase deploys an Edge Function, so this file was never part of what
// the live v542 bundle's file listing returned during Phase A source
// reconciliation (get_edge_function only returns what's actually in the deployed
// bundle) — but real local tooling (`deno check`, `supabase functions serve`,
// editor typechecking) still needs the module to exist and resolve.
//
// Every field below was derived from how each type is actually constructed or
// read at its call sites (not guessed): GroqRateLimitHeaders from
// parseGroqRateLimitHeaders's return object in retry.ts; GroqModelsConfig from
// config/groq-models.json's real shape via allowlist.ts's `as GroqModelsConfig`
// cast; AiProvider/StructuredGenerationScope from the literal string comparisons
// in structured.ts; StructuredGenerationOptions/Log/Result from every `options.*`
// read and every `log`/`return` object literal built in structured.ts's three
// generate*Structured functions. If the real deployed file differs, this is a
// type-only shim (zero runtime effect) — replace it with the actual source
// rather than trusting this reconstruction as authoritative.

export type AiProvider = "gemini" | "groq" | "workers-ai";

export type StructuredGenerationScope = "default" | "bi" | "dna";

export type GroqRateLimitHeaders = {
  retryAfterMs?: number;
  limitRequests?: number;
  remainingRequests?: number;
  limitTokens?: number;
  remainingTokens?: number;
};

export type GroqModelEntry = {
  id: string;
  tier: string;
  strictStructured: boolean;
  parallelTools: boolean;
  promptCaching: boolean;
  evaluationOnly: boolean;
  productionDefault: boolean;
  deprecatedAfter?: string;
  replacementModel?: string;
};

export type GroqModelsConfig = {
  $schema?: string;
  version: number;
  updatedAt: string;
  envMapping: Record<string, string>;
  defaults: Record<string, string>;
  models: GroqModelEntry[];
};

export type StructuredGenerationOptions = {
  systemPrompt: string;
  userContent: string;
  jsonSchema: Record<string, unknown>;
  geminiResponseSchema?: object;
  temperature?: number;
  timeoutMs?: number;
  tier?: string;
  schemaName?: string;
  maxCompletionTokens?: number;
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
  xGroqRequestId?: string;
  usage?: StructuredGenerationUsage;
};

export type StructuredGenerationResult<T> = {
  data: T;
  text: string;
  log: StructuredGenerationLog;
};
