import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const tsx = join(root, "node_modules/.bin/tsx");
const fixture = join(root, "tests/fixtures/remote-mastra-control");
const children: ChildProcessWithoutNullStreams[] = [];

function start(file: string, ...args: string[]) {
  const child = spawn(tsx, [join(fixture, file), ...args], { cwd: root, env: process.env });
  children.push(child);
  return child;
}

function waitFor(child: ChildProcessWithoutNullStreams, text: string, timeout = 8000) {
  return new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${text}\n${output}`)), timeout);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes(text)) { clearTimeout(timer); resolve(output); }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => { if (!output.includes(text)) { clearTimeout(timer); reject(new Error(`Exited ${code} before ${text}\n${output}`)); } });
  });
}

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (!child.killed) child.kill("SIGTERM");
      await once(child, "exit");
    }),
  );
});

describe("remote Mastra cross-process run control", () => {
  it("A starts R1, B stops R1, then stale Stop(R1) cannot stop R2", async () => {
    const server = start("server.ts");
    const serverOut = await waitFor(server, "SERVER_READY");
    const port = /SERVER_READY .*port=(\d+)/.exec(serverOut)?.[1];
    expect(port).toBeTruthy();
    const baseUrl = `http://127.0.0.1:${port}`;

    const unauthenticatedWorkflow = await fetch(`${baseUrl}/api/workflows`);
    expect(unauthenticatedWorkflow.status).toBe(401);

    const unauthenticatedControl = await fetch(`${baseUrl}/ipix/run-control/active`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: "thread-1" }),
    });
    expect(unauthenticatedControl.status).toBe(401);

    const malformed = await fetch(`${baseUrl}/ipix/run-control/abort`, {
      method: "POST",
      headers: { Authorization: "Bearer org-a-token", "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "invalid_request" });

    const empty = await fetch(`${baseUrl}/ipix/run-control/active`, {
      method: "POST",
      headers: { Authorization: "Bearer org-a-token", "content-type": "application/json" },
    });
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toEqual({ error: "invalid_request" });

    const a1 = start("starter.ts", "R1", baseUrl);
    await waitFor(a1, "START_TICK run=R1");
    const orgB = start("controller.ts", "org-b", baseUrl);
    const orgBOut = await waitFor(orgB, "B_ORG_B_ABORT aborted=false");
    expect(orgBOut).toContain("B_ORG_B_ACTIVE run=null");
    const b1 = start("controller.ts", "stop-r1", baseUrl);
    const b1Out = await waitFor(b1, "B_ABORT_R1 aborted=true");
    expect(b1Out).toContain("B_ACTIVE run=R1");
    await waitFor(a1, "STARTER_DONE run=R1");

    const a2 = start("starter.ts", "R2", baseUrl);
    await waitFor(a2, "START_TICK run=R2");
    const b2 = start("controller.ts", "stale-r1", baseUrl);
    const staleOut = await waitFor(b2, "B_STALE_R1 aborted=false");
    expect(staleOut).toContain("B_TICK mode=stale-r1");
    const r2Out = await waitFor(a2, "STARTER_DONE run=R2");
    expect(r2Out).toContain("START_TICK run=R2");
  }, 20000);
});
