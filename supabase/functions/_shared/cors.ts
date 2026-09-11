/** Shared CORS headers for iPix edge functions. */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Respond to browser preflight. Returns null for non-OPTIONS requests. */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

export function withCors(headers: HeadersInit = {}): HeadersInit {
  return { ...corsHeaders, ...headers };
}
