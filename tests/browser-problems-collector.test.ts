import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { collectBrowserProblems } from "../e2e/support/browser-problems";

/**
 * IPI-1329 · MASTRA-INPROC-001 review follow-up: the journeys depend on
 * `collectBrowserProblems`, so its wiring is covered directly — which events it
 * listens to, what a recorded problem looks like, and that a recorded console
 * error names the failing resource URL instead of an anonymous
 * "Failed to load resource".
 */
type Handler = (argument: never) => void;

function createFakePage() {
  const handlers = new Map<string, Handler[]>();
  const page = {
    on(event: string, handler: Handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return page;
    },
  };
  return {
    page: page as unknown as Page,
    emit(event: string, argument: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        (handler as (value: unknown) => void)(argument);
      }
    },
  };
}

const consoleMessage = (type: string, text: string, url = "") => ({
  type: () => type,
  text: () => text,
  location: () => ({ url }),
});

const responseEvent = (status: number, url: string, method = "POST") => ({
  status: () => status,
  url: () => url,
  request: () => ({ method: () => method }),
});

const INSIGHTS_SCRIPT = "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js";
const FAILED_404 = "Failed to load resource: the server responded with a status of 404 ()";

describe("collectBrowserProblems", () => {
  it("records an application console error and names the failing resource URL", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("console", consoleMessage("error", "Failed to load resource: 404 ()", "https://www.ipix.co/api/planner/threads"));

    expect(problems).toEqual([
      "console.error: Failed to load resource: 404 () (https://www.ipix.co/api/planner/threads)",
    ]);
  });

  it("drops the parenthetical when the message carries no resource URL", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("console", consoleMessage("error", "Something broke"));

    expect(problems).toEqual(["console.error: Something broke"]);
  });

  it("does not record the provider-owned analytics 404", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("console", consoleMessage("error", FAILED_404, INSIGHTS_SCRIPT));

    expect(problems).toEqual([]);
  });

  it("still records a non-404 error raised by that same script", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("console", consoleMessage("error", "TypeError: analytics exploded", INSIGHTS_SCRIPT));

    expect(problems).toEqual([
      `console.error: TypeError: analytics exploded (${INSIGHTS_SCRIPT})`,
    ]);
  });

  it("ignores non-error console output", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("console", consoleMessage("log", "hello"));
    emit("console", consoleMessage("warning", "careful"));

    expect(problems).toEqual([]);
  });

  it("records 5xx responses with their method and URL, and ignores 4xx", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("response", responseEvent(503, "https://www.ipix.co/api/copilotkit", "POST"));
    emit("response", responseEvent(404, "https://www.ipix.co/api/missing", "GET"));

    expect(problems).toEqual(["HTTP 503 POST https://www.ipix.co/api/copilotkit"]);
  });

  it("records uncaught page errors", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page);

    emit("pageerror", { message: "Hydration failed" });

    expect(problems).toEqual(["pageerror: Hydration failed"]);
  });

  it("suppresses only the messages a journey deliberately provokes", () => {
    const { page, emit } = createFakePage();
    const problems = collectBrowserProblems(page, [/forced 500/]);

    emit("console", consoleMessage("error", "the forced 500 was handled"));
    emit("console", consoleMessage("error", "an unrelated failure"));

    expect(problems).toEqual(["console.error: an unrelated failure"]);
  });
});
