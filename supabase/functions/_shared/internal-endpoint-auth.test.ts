// IPI-1348 · BRAND-INTEL-PROD-002 — with platform verify_jwt off, the two
// internal Brand Intelligence endpoints must still reject callers that do not
// hold the project's backend secret key, before doing any work.
import { handleBrandIntelligenceRequest } from "../brand-intelligence/handler.ts";
import { handleStartBrandCrawl } from "../start-brand-crawl/handler.ts";

const ENV = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "anon-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role-test",
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_default_test" }),
  FIRECRAWL_API_KEY: "fc-test",
} as const;

async function withEnv(fn: () => Promise<void>) {
  const original = Object.fromEntries(
    Object.keys(ENV).map((name) => [name, Deno.env.get(name)]),
  );
  for (const [name, value] of Object.entries(ENV)) Deno.env.set(name, value);
  try {
    await fn();
  } finally {
    for (const [name, value] of Object.entries(original)) {
      value == null ? Deno.env.delete(name) : Deno.env.set(name, value);
    }
  }
}

const HANDLERS = [
  ["start-brand-crawl", handleStartBrandCrawl],
  ["brand-intelligence", handleBrandIntelligenceRequest],
] as const;

const CALLERS: Array<[string, Record<string, string>]> = [
  ["no credentials", {}],
  ["an unknown secret key", { apikey: "sb_secret_not_this_project" }],
  ["a publishable key", { apikey: "sb_publishable_test" }],
];

for (const [name, handler] of HANDLERS) {
  for (const [label, headers] of CALLERS) {
    Deno.test({
      name: `${name} rejects ${label} with 401`,
      sanitizeOps: false,
      sanitizeResources: false,
      async fn() {
        await withEnv(async () => {
          const res = await handler(
            new Request(`http://localhost/functions/v1/${name}`, {
              method: "POST",
              headers: { "content-type": "application/json", ...headers },
              body: JSON.stringify({ brandId: "11111111-1111-4111-8111-111111111111" }),
            }),
          );
          await res.body?.cancel();
          if (res.status !== 401) {
            throw new Error(`expected 401, got ${res.status}`);
          }
        });
      },
    });
  }
}

// A signed-in operator's session is still not a service caller. Stub only the
// Supabase Auth /user lookup so resolveCaller resolves a real user id, then
// require the handlers' own `caller.userId !== null` check to answer 403.
for (const [name, handler] of HANDLERS) {
  Deno.test({
    name: `${name} rejects a valid user session with 403`,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
      const originalFetch = globalThis.fetch;
      const authCalls: string[] = [];
      globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.startsWith(`${ENV.SUPABASE_URL}/auth/v1/user`)) {
          authCalls.push(url);
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "33333333-3333-4333-8333-333333333333",
                aud: "authenticated",
                role: "authenticated",
                email: "operator@ipix.test",
                app_metadata: {},
                user_metadata: {},
                created_at: new Date().toISOString(),
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
          );
        }
        return originalFetch(input, init);
      }) as typeof fetch;
      try {
        await withEnv(async () => {
          const res = await handler(
            new Request(`http://localhost/functions/v1/${name}`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                Authorization: "Bearer operator-session-token",
              },
              body: JSON.stringify({
                brandId: "11111111-1111-4111-8111-111111111111",
                url: "https://brand.example",
              }),
            }),
          );
          await res.body?.cancel();
          if (authCalls.length === 0) {
            throw new Error("expected the session to be checked with Supabase Auth");
          }
          if (res.status !== 403) {
            throw new Error(`expected 403 for a user session, got ${res.status}`);
          }
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  });
}
