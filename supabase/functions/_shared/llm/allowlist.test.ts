import { resolveBiProviderFromEnv } from "./allowlist.ts";

// Regression for the P2 finding on PR #129: an explicit scoped BI_PROVIDER
// must win outright, including over a non-Gemini global AI_PROVIDER used by
// other paths (e.g. DNA defaults to Groq pending its golden eval).

function assertThrowsSync(fn: () => unknown, label: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`expected "${label}" to throw`);
}

Deno.test("resolveBiProviderFromEnv: BI_PROVIDER=gemini wins over a non-Gemini AI_PROVIDER", () => {
  const result = resolveBiProviderFromEnv({
    biProvider: "gemini",
    aiProvider: "groq",
  });
  if (result !== "gemini") {
    throw new Error(`expected "gemini", got "${result}"`);
  }
});

Deno.test("resolveBiProviderFromEnv: unset BI_PROVIDER still fails closed on a non-Gemini AI_PROVIDER", () => {
  assertThrowsSync(
    () => resolveBiProviderFromEnv({ aiProvider: "groq" }),
    "unset BI_PROVIDER, AI_PROVIDER=groq",
  );
});

Deno.test("resolveBiProviderFromEnv: explicit non-Gemini BI_PROVIDER fails closed", () => {
  assertThrowsSync(
    () => resolveBiProviderFromEnv({ biProvider: "groq" }),
    "BI_PROVIDER=groq",
  );
});

Deno.test("resolveBiProviderFromEnv: BI_USE_GEMINI=1 still works when BI_PROVIDER is unset", () => {
  const result = resolveBiProviderFromEnv({
    biUseGemini: "1",
    aiProvider: "groq",
  });
  if (result !== "gemini") {
    throw new Error(`expected "gemini", got "${result}"`);
  }
});

Deno.test("resolveBiProviderFromEnv: everything unset defaults to gemini", () => {
  const result = resolveBiProviderFromEnv({});
  if (result !== "gemini") {
    throw new Error(`expected "gemini", got "${result}"`);
  }
});
