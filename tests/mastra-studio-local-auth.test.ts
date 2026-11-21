import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { createNodeServer } from "@mastra/deployer/server";
import {
  getLocalStudioCurrentUser,
  isAllowedLocalStudioRoute,
  isAllowedMastraRoute,
  isLoopbackMastraStudioDev,
  localStudioAuth,
  plannerMastraAuth,
} from "@/mastra/server-auth";

describe("local Mastra Studio auth isolation", () => {
  const localDev = {
    NODE_ENV: "production" as const,
    MASTRA_DEV: "true",
    MASTRA_TELEMETRY_COMMAND: "dev",
    MASTRA_HOST: "127.0.0.1",
  };

  it("enables Studio access only for a CLI dev server bound to loopback", () => {
    expect(isLoopbackMastraStudioDev(localDev)).toBe(true);
    expect(isLoopbackMastraStudioDev({ ...localDev, IPIX_MASTRA_HOSTED: "1" })).toBe(false);
    expect(isLoopbackMastraStudioDev({ ...localDev, MASTRA_DEV: "false" })).toBe(false);
    expect(isLoopbackMastraStudioDev({ ...localDev, MASTRA_TELEMETRY_COMMAND: "build" })).toBe(false);
    expect(isLoopbackMastraStudioDev({ ...localDev, MASTRA_HOST: "0.0.0.0" })).toBe(false);
    expect(isLoopbackMastraStudioDev({ ...localDev, MASTRA_HOST: "localhost" })).toBe(false);
  });

  it("allows only exact Studio metadata GETs, not user data or writes", () => {
    for (const path of [
      "/api/agents",
      "/api/processors",
      "/api/tools",
      "/api/scores/scorers",
      "/api/system/packages",
      "/api/mcp/v0/servers",
      "/api/workflows",
      "/api/workspaces",
      "/api/editor/builder/settings",
    ]) {
      expect(isAllowedLocalStudioRoute("GET", path)).toBe(true);
      expect(isAllowedMastraRoute("GET", path)).toBe(path === "/api/agents");
      expect(isAllowedLocalStudioRoute("POST", path)).toBe(false);
    }
    for (const path of [
      "/api/memory",
      "/api/stored-agents",
      "/api/workflows/brand-intelligence/runs",
      "/ipix/run-control/abort",
      "/api/agents/production-planner/stream",
      "/api/tools/secret/execute",
      "/api/workflows/",
    ]) {
      expect(isAllowedLocalStudioRoute("GET", path)).toBe(false);
    }
  });

  it("returns no Studio user if Supabase identity verification rejects, without leaking the error", async () => {
    const request = new Request("http://127.0.0.1/api/auth/capabilities", {
      headers: { Authorization: "Bearer simulated-outage" },
    });
    const identityOutage = async (): Promise<never> => {
      throw new Error("Simulated Supabase network failure");
    };
    await expect(getLocalStudioCurrentUser(request, identityOutage)).resolves.toBeNull();
    await expect(getLocalStudioCurrentUser(new Request(request.url), identityOutage)).resolves.toBeNull();
  });

  it("authenticates Studio metadata but does not open the normal Mastra API", async () => {
    const user = { id: "test-user", orgId: "test-org", resourceId: "test-resource" };
    const validTokens = new Map([["valid-test-token", user]]);
    const verify = async (token: string) => {
      const verifiedUser = validTokens.get(token);
      if (!verifiedUser) throw new Error("Invalid token");
      return verifiedUser;
    };
    expect(typeof localStudioAuth.getCurrentUser).toBe("function");
    const localTestStudioAuth = {
      ...localStudioAuth,
      authenticateToken: verify,
      getCurrentUser: (request: Request) => getLocalStudioCurrentUser(request, verify),
    };
    const mastra = new Mastra({
      server: {
        host: "127.0.0.1",
        port: 0,
        handleShutdownSignals: false,
        auth: { ...plannerMastraAuth, authenticateToken: verify },
      },
      studio: { auth: localTestStudioAuth },
    });
    const server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
    try {
      if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const route = `${base}/api/workflows`;
      const noAuth = await fetch(route);
      const normal = await fetch(route, { headers: { Authorization: "Bearer valid-test-token" } });
      const studio = await fetch(route, {
        headers: { Authorization: "Bearer valid-test-token", "x-mastra-client-type": "studio" },
      });
      const forged = await fetch(route, {
        headers: { Authorization: "Bearer invalid-token", "x-mastra-client-type": "studio" },
      });
      expect([noAuth.status, normal.status, studio.status, forged.status]).toEqual([401, 403, 200, 401]);
      const capabilities = `${base}/api/auth/capabilities`;
      const studioHeaders = { Authorization: "Bearer valid-test-token", "x-mastra-client-type": "studio" };
      const anonymousCapabilities = await (await fetch(capabilities, {
        headers: { "x-mastra-client-type": "studio" },
      })).json();
      const authenticatedCapabilities = await (await fetch(capabilities, { headers: studioHeaders })).json();
      expect(anonymousCapabilities.user).toBeUndefined();
      expect(authenticatedCapabilities.user?.id).toBe(user.id);
      // A rejected identity lookup must not turn Studio's capabilities route into 500.
      const failedCapabilities = await fetch(capabilities, {
        headers: { Authorization: "Bearer invalid-token", "x-mastra-client-type": "studio" },
      });
      expect(failedCapabilities.status).toBe(200);
      expect((await failedCapabilities.json()).user).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
