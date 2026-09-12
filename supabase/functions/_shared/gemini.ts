import { GoogleGenAI, type GenerateContentResponse } from "npm:@google/genai@2.8.0";

import { getOptionalSecret } from "./env.ts";

/** Default text model for iPix edge functions (IPI-223 — aligned with app registry). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const KNOWN_MODEL_IDS: string[] = [
  DEFAULT_GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
];

/**
 * Resolve Gemini model from GEMINI_MODEL secret, else default.
 * Unknown overrides throw (mirrors app/src/mastra/models.ts — IPI-223).
 */
export function resolveGeminiModel(): string {
  const override = getOptionalSecret("GEMINI_MODEL")?.trim() ?? "";
  if (override) {
    if (!KNOWN_MODEL_IDS.includes(override)) {
      throw new Error(
        `GEMINI_MODEL="${override}" is not in the registry (${KNOWN_MODEL_IDS.join(", ")}).`,
      );
    }
    return override;
  }
  return DEFAULT_GEMINI_MODEL;
}

function normalizeThinkingLevel(level: "high" | "low"): "HIGH" | "LOW" {
  return level === "high" ? "HIGH" : "LOW";
}

/**
 * PR review finding — the previous Promise.race implementation stopped
 * *waiting* on timeout but never cancelled the underlying Gemini request;
 * the HTTP call kept running server-side after the caller gave up. Verified
 * against the exact pinned `npm:@google/genai@2.8.0` tag (not guessed):
 * `GenerateContentConfig.abortSignal?: AbortSignal` is a real field, passed
 * through to the request. Takes a factory (not an already-started promise)
 * because the signal must be wired into `config.abortSignal` before
 * `generateContent` is called, not after.
 *
 * Google's own doc comment on that field: "AbortSignal is a client-only
 * operation... will not cancel the request in the service. You will still
 * be charged usage." So this still doesn't reduce Gemini-side cost/billing
 * for an aborted call — it bounds how long *this* function waits and frees
 * its own resources immediately, which is the actual reliability goal here.
 */
export function withTimeout<T>(
  makeRequest: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Gemini timeout after ${ms}ms`)),
    ms,
  );
  return makeRequest(controller.signal).finally(() => clearTimeout(timer));
}

type GeminiTool =
  | { urlContext: Record<string, never> }
  | { googleSearch: Record<string, never> };

export type GenerateStructuredOptions = {
  apiKey: string;
  contents: string;
  responseSchema: object;
  model?: string;
  tools?: GeminiTool[];
  thinkingLevel?: "high" | "low";
  temperature?: number;
  timeoutMs?: number;
};

/** Structured JSON generation via responseSchema (no urlContext — incompatible with JSON mode). */
export async function generateStructuredContent(
  options: GenerateStructuredOptions,
): Promise<{ response: GenerateContentResponse; text: string; model: string }> {
  const model = options.model ?? resolveGeminiModel();
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: options.responseSchema,
  };

  if (options.tools?.length) {
    config.tools = options.tools;
  }
  if (options.thinkingLevel) {
    config.thinkingConfig = {
      thinkingLevel: normalizeThinkingLevel(options.thinkingLevel),
    };
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }

  const response = await withTimeout(
    (signal) =>
      ai.models.generateContent({
        model,
        contents: options.contents,
        config: { ...config, abortSignal: signal },
      }),
    options.timeoutMs ?? 45_000,
  );

  const text = response.text ?? "";
  if (!text.trim()) {
    throw new Error("Empty structured response from Gemini");
  }

  return { response, text, model };
}

/** Unstructured pass — urlContext + googleSearch (cannot combine with responseSchema). */
export async function generateContextPass(
  options: {
    apiKey: string;
    contents: string;
    model?: string;
    timeoutMs?: number;
  },
): Promise<{ response: GenerateContentResponse; text: string; model: string }> {
  const model = options.model ?? resolveGeminiModel();
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  const response = await withTimeout(
    (signal) =>
      ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
          temperature: 0.2,
          abortSignal: signal,
        },
      }),
    options.timeoutMs ?? 45_000,
  );

  const text =
    response.text?.trim() ||
    "No textual analysis returned from URL context.";

  return { response, text, model };
}
