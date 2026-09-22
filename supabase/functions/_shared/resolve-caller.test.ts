import { resolveCaller } from "./resolve-caller.ts";

const ORIGINAL_ENV = {
  url: Deno.env.get("SUPABASE_URL"),
  anon: Deno.env.get("SUPABASE_ANON_KEY"),
  service: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  secrets: Deno.env.get("SUPABASE_SECRET_KEYS"),
};

function restoreEnv() {
  const pairs = [
    ["SUPABASE_URL", ORIGINAL_ENV.url],
    ["SUPABASE_ANON_KEY", ORIGINAL_ENV.anon],
    ["SUPABASE_SERVICE_ROLE_KEY", ORIGINAL_ENV.service],
    ["SUPABASE_SECRET_KEYS", ORIGINAL_ENV.secrets],
  ] as const;
  for (const [name, value] of pairs) value == null ? Deno.env.delete(name) : Deno.env.set(name, value);
}

Deno.test({
  name: "resolveCaller accepts a configured modern secret key from the apikey header",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify({ default: "sb_secret_modern_test" }));

      const result = await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { apikey: "sb_secret_modern_test" },
        }),
      );

      if ("response" in result) {
        throw new Error(`expected trusted service caller, got HTTP ${result.response.status}`);
      }
      if (result.userId !== null) throw new Error("expected service caller userId to be null");
    } finally {
      restoreEnv();
    }
  },
});
