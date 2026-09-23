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
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
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

Deno.test({
  name: "resolveCaller does not authorize characters from malformed secret-key JSON",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify("abc"));

      const result = await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { apikey: "a" },
        }),
      );
      if (!("response" in result) || result.response.status !== 401) {
        throw new Error("malformed secret-key JSON must not authorize the caller");
      }
    } finally {
      restoreEnv();
    }
  },
});

Deno.test({
  name: "resolveCaller fails closed when SUPABASE_SECRET_KEYS is null JSON",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", "null");

      const result = await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { apikey: "anything" },
        }),
      );
      if (!("response" in result) || result.response.status !== 401) {
        throw new Error("null secret-key JSON must fail closed");
      }
    } finally {
      restoreEnv();
    }
  },
});
Deno.test({
  name: "resolveCaller logs malformed modern secret-key configuration without exposing values",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const originalError = console.error;
    const messages: string[] = [];
    try {
      console.error = (...args: unknown[]) => messages.push(args.map(String).join(" "));
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify("not-an-object"));

      await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { apikey: "not-configured" },
        }),
      );

      if (!messages.some((message) => message.includes("Invalid SUPABASE_SECRET_KEYS"))) {
        throw new Error("expected invalid secret-key configuration to be logged");
      }
      if (messages.some((message) => message.includes("not-an-object"))) {
        throw new Error("configuration log must not expose secret config values");
      }
    } finally {
      console.error = originalError;
      restoreEnv();
    }
  },
});

Deno.test({
  name: "resolveCaller logs invalid SUPABASE_SECRET_KEYS JSON",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const originalError = console.error;
    const messages: string[] = [];
    try {
      console.error = (...args: unknown[]) => messages.push(args.map(String).join(" "));
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", "{invalid-json");

      await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { apikey: "not-configured" },
        }),
      );

      if (!messages.some((message) => message.includes("Invalid SUPABASE_SECRET_KEYS"))) {
        throw new Error("expected invalid JSON configuration to be logged");
      }
      if (messages.some((message) => message.includes("{invalid-json"))) {
        throw new Error("configuration log must not expose secret config values");
      }
    } finally {
      console.error = originalError;
      restoreEnv();
    }
  },
});

Deno.test({
  name: "resolveCaller accepts only the canonical default modern secret key",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify({ default: "sb_secret_default_test", custom: "sb_secret_custom_test" }));

      const custom = await resolveCaller(new Request("http://localhost/functions/v1/start-brand-crawl", { headers: { apikey: "sb_secret_custom_test" } }));
      if (!("response" in custom) || custom.response.status !== 401) {
        throw new Error("non-default modern secret key must not authorize the caller");
      }

      const canonical = await resolveCaller(new Request("http://localhost/functions/v1/start-brand-crawl", { headers: { apikey: "sb_secret_default_test" } }));
      if ("response" in canonical || canonical.userId !== null) {
        throw new Error("default modern secret key must authorize the service caller");
      }
    } finally {
      restoreEnv();
    }
  },
});

Deno.test({
  name: "resolveCaller fails closed instead of throwing when modern key config is malformed and legacy key is absent",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
      Deno.env.set("SUPABASE_SECRET_KEYS", "{invalid-json");

      const result = await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { Authorization: "Bearer ordinary-user-token" },
        }),
      );

      if (!("response" in result) || result.response.status !== 401) {
        throw new Error("malformed modern config without a legacy key must fail closed with 401");
      }
    } finally {
      restoreEnv();
    }
  },
});

Deno.test({
  name: "resolveCaller preserves legacy service-role Bearer compatibility",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    try {
      Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
      Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-test");
      Deno.env.delete("SUPABASE_SECRET_KEYS");

      const result = await resolveCaller(
        new Request("http://localhost/functions/v1/start-brand-crawl", {
          headers: { Authorization: "Bearer legacy-service-role-test" },
        }),
      );

      if ("response" in result || result.userId !== null) {
        throw new Error("legacy service-role Bearer token must remain a trusted service caller");
      }
    } finally {
      restoreEnv();
    }
  },
});
