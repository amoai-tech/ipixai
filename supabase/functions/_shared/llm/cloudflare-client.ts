import { getOptionalSecret } from "../env.ts";
import { resolveCloudflareGatewayId } from "./allowlist.ts";
import {
  assertNoDeprecatedToolApi,
  assertStructuredRequestOptions,
  orderPromptMessages,
} from "./constraints.ts";
import { withGroqRetry } from "./retry.ts";

/**
 * IPI-741 / IPI-743 — Cloudflare AI Gateway REST from Deno Edge.
 * Harden via one thin `gatewayFetch` layer + official `cf-aig-*` headers.
 * Upstream retries: prefer Gateway dashboard Retry + `cf-aig-max-attempts`;
 * client `withGroqRetry` stays for 429/502/503 only.
 * @see https://developers.cloudflare.com/ai-gateway/usage/rest-api/
 * @see https://developers.cloudflare.com/ai-gateway/observability/logging/
 * @see https://developers.cloudflare.com/ai-gateway/configuration/request-handling/
 */

/** Gateway-facing timeout (ms) for `cf-aig-request-timeout`. */
export const CLOUDFLARE_GATEWAY_TIMEOUT_MS = 60_000;
/** Client AbortController margin so Gateway can return a structured 504 first. */
export const CLOUDFLARE_CLIENT_ABORT_MARGIN_MS = 5_000;
/** Client `withGroqRetry` attempts for 429/502/503 (combined ceiling with gateway ≤ 4). */
const CLOUDFLARE_CLIENT_RETRY_ATTEMPTS = 2;

const ERROR_LABEL: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  409: "Conflict",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export type CloudflareCredentialPath = "gateway_token" | "api_token";

export class CloudflareGatewayError extends Error {
  readonly status: number;
  readonly cfRay?: string;
  readonly requestId?: string;
  readonly credentialPath?: CloudflareCredentialPath;

  constructor(
    message: string,
    opts: {
      status: number;
      cfRay?: string;
      requestId?: string;
      credentialPath?: CloudflareCredentialPath;
    },
  ) {
    super(redactSecrets(message));
    this.name = "CloudflareGatewayError";
    this.status = opts.status;
    this.cfRay = opts.cfRay;
    this.requestId = opts.requestId;
    this.credentialPath = opts.credentialPath;
  }
}

function resolveBaseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
}

/** Strip tokens / bearer material from error text. Never logs bodies. */
export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(sk-|cfapat_|eyJ)[A-Za-z0-9._-]{8,}/g, "[REDACTED]");
}

export function resolveCloudflareCredentials(): {
  token: string;
  accountId: string;
  credentialPath: CloudflareCredentialPath;
} {
  const accountId = (getOptionalSecret("CLOUDFLARE_ACCOUNT_ID") ?? "").trim();
  const gatewayToken = getOptionalSecret("CLOUDFLARE_AI_GATEWAY_TOKEN");
  const apiToken = getOptionalSecret("CLOUDFLARE_API_TOKEN");
  const token = (gatewayToken ?? "").trim() || (apiToken ?? "").trim();
  if (!token || !accountId) {
    throw new CloudflareGatewayError(
      "CLOUDFLARE_AI_GATEWAY_TOKEN (or CLOUDFLARE_API_TOKEN) and CLOUDFLARE_ACCOUNT_ID are not configured.",
      { status: 500 },
    );
  }
  return {
    token,
    accountId,
    credentialPath: gatewayToken?.trim() ? "gateway_token" : "api_token",
  };
}

export function buildGatewayHeaders(
  token: string,
  options?: { timeoutMs?: number },
): Record<string, string> {
  const timeoutMs = options?.timeoutMs ?? CLOUDFLARE_GATEWAY_TIMEOUT_MS;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "cf-aig-gateway-id": resolveCloudflareGatewayId(),
    // Privacy: metadata OK; prompt/response bodies off (defaults to true otherwise).
    "cf-aig-collect-log-payload": "false",
    // Official Gateway timeout (ms). Client abort uses this + CLOUDFLARE_CLIENT_ABORT_MARGIN_MS.
    "cf-aig-request-timeout": String(timeoutMs),
    // Gateway upstream attempts; with client retry(2) combined ceiling ≤ 4 for 429/502/503.
    "cf-aig-max-attempts": "2",
    "cf-aig-retry-delay": "500",
    "cf-aig-backoff": "exponential",
  };
}

export function extractRequestMeta(headers: Headers): {
  cfRay?: string;
  requestId?: string;
} {
  const cfRay = headers.get("cf-ray") ?? undefined;
  const requestId =
    headers.get("cf-aig-request-id") ??
    headers.get("x-request-id") ??
    headers.get("cf-request-id") ??
    undefined;
  return { cfRay: cfRay || undefined, requestId: requestId || undefined };
}

export type GatewayFetchOptions = {
  method?: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

/**
 * Single networking entry: timeout → fetch → (caller handles retry/parse).
 * ponytail: no telemetry/provider options — one BI caller today.
 */
export async function gatewayFetch(
  url: string,
  options: GatewayFetchOptions,
): Promise<Response> {
  const gatewayTimeoutMs = options.timeoutMs ?? CLOUDFLARE_GATEWAY_TIMEOUT_MS;
  // Explicit timeoutMs = exact abort (tests/callers). Default path adds margin so Gateway 504 can return.
  const abortMs = options.timeoutMs != null
    ? gatewayTimeoutMs
    : gatewayTimeoutMs + CLOUDFLARE_CLIENT_ABORT_MARGIN_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), abortMs);
  try {
    return await fetch(url, {
      method: options.method ?? "POST",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      throw new CloudflareGatewayError(
        `Workers AI request timed out after ${abortMs}ms`,
        { status: 408 },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseGatewayResponse(
  response: Response,
  credentialPath?: CloudflareCredentialPath,
): Promise<Record<string, unknown>> {
  const meta = extractRequestMeta(response.headers);
  const payload = await readCloudflareJsonPayload(response, meta, credentialPath);

  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    const label = ERROR_LABEL[response.status] ?? `HTTP ${response.status}`;
    const message = typeof err?.message === "string" && err.message.trim()
      ? err.message
      : `Workers AI ${label}`;
    throw new CloudflareGatewayError(message, {
      status: response.status,
      cfRay: meta.cfRay,
      requestId: meta.requestId,
      credentialPath,
    });
  }

  return payload;
}

/**
 * Workers AI's OpenAI-compat endpoint takes `max_tokens` (default 256 —
 * far too small for a Brand Profile JSON response), not Groq's
 * `max_completion_tokens`.
 */
export type CloudflareChatRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  functions?: unknown;
  function_call?: unknown;
  max_tokens?: number;
  temperature?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
};

export type CloudflareStructuredCallResult = {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Safe enum only — never the secret value. */
  credentialPath?: CloudflareCredentialPath;
  cfRay?: string;
  requestId?: string;
};

export async function cloudflareStructuredCompletion(
  request: CloudflareChatRequest,
): Promise<CloudflareStructuredCallResult> {
  assertNoDeprecatedToolApi(request);
  assertStructuredRequestOptions(request);
  const body: CloudflareChatRequest = {
    ...request,
    max_tokens: request.max_tokens ?? 4096,
  };

  const { token, accountId, credentialPath } = resolveCloudflareCredentials();
  const headers = buildGatewayHeaders(token);
  const url = `${resolveBaseUrl(accountId)}/chat/completions`;

  // 429/502/503 only at client; combined with cf-aig-max-attempts(2) ≤ 4 upstream tries.
  const response = await withGroqRetry(
    () =>
      gatewayFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    CLOUDFLARE_CLIENT_RETRY_ATTEMPTS,
  );

  const meta = extractRequestMeta(response.headers);
  const payload = await parseGatewayResponse(response, credentialPath);

  const choices = payload.choices as
    | Array<{ message?: { content?: unknown } }>
    | undefined;
  const content = choices?.[0]?.message?.content;
  // Cloudflare's json_schema mode has been observed returning an
  // already-parsed object for `message.content` — normalize to text.
  const text = typeof content === "string"
    ? content.trim()
    : content && typeof content === "object"
    ? JSON.stringify(content)
    : "";
  if (!text) {
    throw new CloudflareGatewayError("Empty structured response from Workers AI", {
      status: 502,
      cfRay: meta.cfRay,
      requestId: meta.requestId,
      credentialPath,
    });
  }

  const usage = payload.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;
  return {
    text,
    model: (payload.model as string | undefined) ?? body.model,
    usage: usage
      ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }
      : undefined,
    credentialPath,
    cfRay: meta.cfRay,
    requestId: meta.requestId,
  };
}

async function readCloudflareJsonPayload(
  response: Response,
  meta: { cfRay?: string; requestId?: string },
  credentialPath?: CloudflareCredentialPath,
): Promise<Record<string, unknown>> {
  const rawBody = await response.text();
  if (!rawBody) return {};

  const contentType = response.headers.get("content-type") ?? "";
  const looksJson = contentType.includes("json") ||
    rawBody.trimStart().startsWith("{");
  if (!looksJson) {
    const label = ERROR_LABEL[response.status] ?? `HTTP ${response.status}`;
    throw new CloudflareGatewayError(
      response.ok
        ? "Workers AI response was not JSON"
        : (redactSecrets(rawBody.slice(0, 200)) || `Workers AI ${label}`),
      {
        status: response.ok ? 502 : response.status,
        cfRay: meta.cfRay,
        requestId: meta.requestId,
        credentialPath,
      },
    );
  }

  try {
    const parsed = JSON.parse(rawBody);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new CloudflareGatewayError(
      response.ok
        ? "Workers AI response was not valid JSON"
        : (redactSecrets(rawBody.slice(0, 200)) ||
          `Workers AI ${ERROR_LABEL[response.status] ?? `HTTP ${response.status}`}`),
      {
        status: response.ok ? 502 : response.status,
        cfRay: meta.cfRay,
        requestId: meta.requestId,
        credentialPath,
      },
    );
  }
}

export function buildCloudflareStrictJsonRequest(
  model: string,
  systemPrompt: string,
  userContent: string,
  schema: Record<string, unknown>,
  schemaName = "response",
  maxTokens = 4096,
): CloudflareChatRequest {
  return {
    model,
    messages: [...orderPromptMessages(systemPrompt, userContent)],
    stream: false,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
  };
}
