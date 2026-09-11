import { getOptionalSecret } from "../env.ts";
import { resolveGroqModelId } from "./allowlist.ts";
import {
  assertNoDeprecatedToolApi,
  assertStructuredRequestOptions,
  normalizeCompletionTokenLimit,
  orderPromptMessages,
  type GroqChatRequest,
} from "./constraints.ts";
import { parseGroqRateLimitHeaders, withGroqRetry } from "./retry.ts";
import type { GroqRateLimitHeaders } from "./types.ts";

function resolveBaseUrl(): string {
  return (getOptionalSecret("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1")
    .replace(/\/$/, "");
}

export type GroqStructuredCallResult = {
  text: string;
  model: string;
  xGroqRequestId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  rateLimits: GroqRateLimitHeaders;
};

export async function groqStructuredCompletion(
  request: GroqChatRequest,
): Promise<GroqStructuredCallResult> {
  assertNoDeprecatedToolApi(request);
  assertStructuredRequestOptions(request);
  const body = normalizeCompletionTokenLimit(request, 4096);
  const apiKey = getOptionalSecret("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured for Groq requests.");
  }

  const response = await withGroqRetry(() =>
    fetch(`${resolveBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  );

  const rateLimits = parseGroqRateLimitHeaders(response.headers);
  const payload = await readGroqJsonPayload(response);

  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    const message =
      typeof err?.message === "string"
        ? err.message
        : `Groq HTTP ${response.status}`;
    throw new Error(message);
  }

  const choices = payload.choices as
    | Array<{ message?: { content?: string } }>
    | undefined;
  const text = choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Empty structured response from Groq");
  }

  const usage = payload.usage as
    | {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    }
    | undefined;
  return {
    text,
    model: (payload.model as string | undefined) ?? body.model,
    xGroqRequestId: response.headers.get("x-groq-id") ??
      response.headers.get("x-request-id") ?? undefined,
    usage: usage
      ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }
      : undefined,
    rateLimits,
  };
}

async function readGroqJsonPayload(
  response: Response,
): Promise<Record<string, unknown>> {
  const rawBody = await response.text();
  if (!rawBody) {
    return {};
  }

  const contentType = response.headers.get("content-type") ?? "";
  const looksJson =
    contentType.includes("json") || rawBody.trimStart().startsWith("{");

  if (!looksJson) {
    if (!response.ok) {
      throw new Error(rawBody.slice(0, 200) || `Groq HTTP ${response.status}`);
    }
    throw new Error("Groq response was not JSON");
  }

  try {
    const parsed = JSON.parse(rawBody);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    if (!response.ok) {
      throw new Error(rawBody.slice(0, 200) || `Groq HTTP ${response.status}`);
    }
    throw new Error("Groq response was not valid JSON");
  }
}

export function buildStrictJsonRequest(
  model: string,
  systemPrompt: string,
  userContent: string,
  schema: Record<string, unknown>,
  schemaName = "response",
  maxCompletionTokens = 4096,
): GroqChatRequest {
  return normalizeCompletionTokenLimit(
    {
      model,
      messages: [...orderPromptMessages(systemPrompt, userContent)],
      stream: false,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    },
    maxCompletionTokens,
  );
}
