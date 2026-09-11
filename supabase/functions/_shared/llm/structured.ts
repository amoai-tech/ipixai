import {
  type BrandProfilePayload,
  validateBrandProfilePayload,
} from "../schemas/brand-profile.ts";
import { getOptionalSecret } from "../env.ts";
import { resolveBiProviderFromEnv } from "./allowlist.ts";
import type { AiProvider, StructuredGenerationScope } from "./types.ts";
import { orderPromptMessages } from "./constraints.ts";
import {
  generateGeminiStructuredContent,
  resolveGeminiModel,
} from "./gemini-client.ts";
import type {
  StructuredGenerationLog,
  StructuredGenerationOptions,
  StructuredGenerationResult,
} from "./types.ts";

const REPAIR_SUFFIX =
  "\n\nReturn valid JSON only. Include every required field from the schema.";

export class StructuredOutputValidationError extends Error {
  override name = "StructuredOutputValidationError";
}

type ParseJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function parseJson(text: string): ParseJsonResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? `Invalid JSON: ${error.message}`
        : "Invalid JSON";
    return { ok: false, error: message };
  }
}

function validatePayload(data: unknown): {
  payload: BrandProfilePayload | null;
  error: string | null;
} {
  if (!data || typeof data !== "object") {
    return { payload: null, error: "Structured payload was not an object" };
  }
  const payload = data as BrandProfilePayload;
  const error = validateBrandProfilePayload(payload);
  return { payload: error ? null : payload, error };
}

function validateParsedText(text: string): {
  payload: BrandProfilePayload | null;
  error: string | null;
} {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return { payload: null, error: parsed.error };
  }
  return validatePayload(parsed.value);
}

async function generateGeminiStructured<T>(
  options: StructuredGenerationOptions,
): Promise<StructuredGenerationResult<T>> {
  const apiKey = getOptionalSecret("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const contents = [
    orderPromptMessages(options.systemPrompt, options.userContent)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n"),
  ].join("\n");

  let result = await generateGeminiStructuredContent({
    apiKey,
    contents,
    responseSchema: options.geminiResponseSchema ?? options.jsonSchema,
    model: resolveGeminiModel(),
    temperature: options.temperature ?? 0.2,
    timeoutMs: options.timeoutMs ?? 45_000,
  });

  let schemaRepairCount = 0;
  let validation = validateParsedText(result.text);

  if (validation.error) {
    schemaRepairCount += 1;
    const repair = await generateGeminiStructuredContent({
      apiKey,
      contents: `${contents}${REPAIR_SUFFIX}`,
      responseSchema: options.geminiResponseSchema ?? options.jsonSchema,
      model: resolveGeminiModel(),
      temperature: 0,
      timeoutMs: options.timeoutMs ?? 45_000,
    });
    // Reassign so data/text/log.model all derive from the same repaired
    // artifact on a successful repair, rather than mixing the validated
    // repair payload with the original (still-invalid) response's text.
    result = repair;
    validation = validateParsedText(result.text);
    if (validation.error) {
      throw new StructuredOutputValidationError(validation.error);
    }
  }

  const log: StructuredGenerationLog = {
    provider: "gemini",
    model: result.model,
    schemaRepairCount,
  };

  return {
    data: validation.payload as T,
    text: result.text,
    log,
  };
}

export function resolveStructuredProviderFromEnv(env: {
  scope?: StructuredGenerationScope;
  aiProvider?: string;
  biUseGemini?: string;
  biProvider?: string;
  dnaUseGemini?: string;
}): AiProvider {
  const scope = env.scope ?? "default";
  if (scope === "bi") {
    return resolveBiProviderFromEnv({
      aiProvider: env.aiProvider,
      biUseGemini: env.biUseGemini,
      biProvider: env.biProvider,
    });
  }
  if (scope === "dna") {
    throw new Error(
      'Structured scope "dna" is not wired in this module; audit-asset-dna owns its provider path separately.',
    );
  }
  const provider = (env.aiProvider ?? "gemini").trim().toLowerCase();
  if (provider === "gemini") return provider;
  throw new Error(
    `AI_PROVIDER="${provider}" is invalid — only gemini is wired in this module (IPI-1093 removed Groq/Cloudflare Workers AI).`,
  );
}

export function resolveStructuredProvider(
  scope: StructuredGenerationScope = "default",
): AiProvider {
  return resolveStructuredProviderFromEnv({
    scope,
    aiProvider: Deno.env.get("AI_PROVIDER"),
    biUseGemini: Deno.env.get("BI_USE_GEMINI"),
    biProvider: Deno.env.get("BI_PROVIDER"),
    dnaUseGemini: Deno.env.get("DNA_USE_GEMINI"),
  });
}

/** Brand-profile validation today; Gemini only (IPI-1093 removed Groq/Cloudflare Workers AI). */
export async function generateStructuredContent<T>(
  options: StructuredGenerationOptions,
): Promise<StructuredGenerationResult<T>> {
  const provider = resolveStructuredProvider(options.scope);
  if (provider === "gemini") {
    return await generateGeminiStructured<T>(options);
  }
  throw new Error(`Structured provider "${provider}" is not wired.`);
}

export { resolveAiProvider, resolveBiProvider } from "./allowlist.ts";
