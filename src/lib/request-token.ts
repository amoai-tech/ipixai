import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped operator access token (JWT) for server-side Mastra tools.
 * Populated in the CopilotKit route around `handle(app)(request)` so tools
 * that need the authenticated caller (e.g. brand-intelligence approval) can
 * resolve the real operator identity instead of trusting browser-supplied IDs.
 */
export const requestToken = new AsyncLocalStorage<string>();