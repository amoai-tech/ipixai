import type { Page, Request } from "@playwright/test";

/**
 * Collects every console.error, uncaught page error, and 5xx response a page
 * produces. A journey ends with `expect(problems).toEqual([])`.
 *
 * `expected` lists messages a test deliberately provokes (for example a forced
 * 500 and the app's own logged handling of it). Anything else still fails.
 */
export function collectBrowserProblems(page: Page, expected: RegExp[] = []) {
  const problems: string[] = [];
  const record = (line: string) => {
    if (!expected.some((pattern) => pattern.test(line))) problems.push(line);
  };
  page.on("console", (message) => {
    if (message.type() === "error") record(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    record(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      record(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return problems;
}

export const isAgentRun = (request: Request) =>
  request.method() === "POST" && /\/agent\/[^/]+\/run/.test(request.url());

export const isAgentStop = (request: Request) =>
  request.method() === "POST" && /\/stop\//.test(request.url());
