import type { User } from "npm:@supabase/supabase-js@2";

import { createUserClient } from "./supabase-client.ts";
import { errorResponse } from "./response.ts";

export type AuthResult =
  | { user: User; accessToken: string }
  | { response: Response };

export type ResolveAuthOptions = {
  required: boolean;
};

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve the caller from Authorization header.
 * When `required: true`, missing/invalid JWT returns a 401 Response.
 */
export async function resolveAuth(
  req: Request,
  options: ResolveAuthOptions,
): Promise<AuthResult> {
  const token = extractBearerToken(req);

  if (!token) {
    if (options.required) {
      return {
        response: errorResponse(
          "unauthorized",
          "Authorization required",
          401,
        ),
      };
    }
    return { response: errorResponse("unauthorized", "No session", 401) };
  }

  const client = createUserClient(token);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return {
      response: errorResponse(
        "unauthorized",
        "Invalid or expired session",
        401,
      ),
    };
  }

  return { user: data.user, accessToken: token };
}

/** Type guard — use after resolveAuth when required: true. */
export function isAuthFailure(
  result: AuthResult,
): result is { response: Response } {
  return "response" in result;
}
