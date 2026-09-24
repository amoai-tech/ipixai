export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function forbiddenResponse(
  reason:
    | "needs_onboarding"
    | "membership_conflict"
    | "thread_forbidden"
    | "ownership",
): Response {
  return new Response(JSON.stringify({ error: "forbidden", reason }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

export function badRequestResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: "bad_request", reason }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export function configUnavailableResponse(reason: string): Response {
  return new Response(
    JSON.stringify({ error: "unavailable", reason }),
    {
      status: 503,
      headers: { "content-type": "application/json" },
    },
  );
}

export function membershipLookupFailedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "unavailable", reason: "membership_lookup_failed" }),
    {
      status: 503,
      headers: { "content-type": "application/json" },
    },
  );
}

export function claimUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({ error: "unavailable", reason: "claim_unavailable" }),
    {
      status: 503,
      headers: { "content-type": "application/json" },
    },
  );
}
