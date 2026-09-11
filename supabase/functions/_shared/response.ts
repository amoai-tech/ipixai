import { corsHeaders } from "./cors.ts";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiErrorBody = {
  ok: false;
  error: { code: string; message: string };
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

/** Standard success envelope: `{ ok: true, data }`. */
export function jsonResponse<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Safe client-facing error — never includes stack traces or env values. */
export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  const body: ApiErrorBody = { ok: false, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function redactSensitiveSubstrings(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]")
    .replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
}

/** Map unknown errors to a safe message for clients. */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = redactSensitiveSubstrings(err.message);
    if (/(service_role|secret_key|password=|authorization:\s*bearer)/i.test(msg)) {
      return "Internal server error";
    }
    return msg.slice(0, 200);
  }
  return "Internal server error";
}
