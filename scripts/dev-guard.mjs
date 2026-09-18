#!/usr/bin/env node
/**
 * Refuse to start a command if one or more TCP ports are already bound.
 * Usage:
 *   node scripts/dev-guard.mjs --port 3000 -- next dev --turbopack
 *   node scripts/dev-guard.mjs --port 3000 --port 4111 -- next build
 *
 * When the Mastra agent port is requested, the child also inherits a loopback
 * MASTRA_HOST default so `mastra dev` cannot expose its unauthenticated
 * tool-execute API to the local network. See resolveChildEnv below.
 */
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";

const scriptPath = fileURLToPath(import.meta.url);

/** `mastra dev` serves Studio plus an unauthenticated tool-execute API on this port. */
const AGENT_PORT = 4111;
const LOOPBACK_HOST = "127.0.0.1";

const PORT_ROLE = {
  3000: "UI (next)",
  [AGENT_PORT]: "agent (mastra)",
};

function parseArgs(argv) {
  const dash = argv.indexOf("--");
  if (dash === -1) {
    throw new Error("dev-guard: expected `-- <command>`");
  }
  const flags = argv.slice(0, dash);
  const command = argv.slice(dash + 1);
  const ports = [];
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === "--port") {
      const port = Number(flags[++i]);
      if (!Number.isInteger(port) || port <= 0) {
        throw new Error("dev-guard: --port <number> is required");
      }
      ports.push(port);
    }
  }
  if (ports.length === 0) {
    throw new Error("dev-guard: at least one --port <number> is required");
  }
  if (command.length === 0) {
    throw new Error("dev-guard: missing command after --");
  }
  return { ports, command };
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function describeListener(port) {
  try {
    const out = execFileSync("ss", ["-ltnp"], {
      encoding: "utf8",
      timeout: 2000,
    });
    const lines = out.split("\n").filter((line) => {
      return (
        line.includes(`:${port} `) ||
        line.includes(`:${port}\n`) ||
        line.endsWith(`:${port}`) ||
        line.includes(`:${port} `) ||
        /:(\d+)\s/.test(line) && line.includes(`:${port}`)
      );
    });
    const hit = out
      .split("\n")
      .find((line) => new RegExp(`[:.]${port}\\s`).test(line));
    if (!hit) return "unknown process";
    const users = hit.match(/users:\(\("([^"]+)",pid=(\d+)/);
    if (users) return `${users[1]} pid=${users[2]}`;
    return hit.trim();
  } catch {
    return "unknown process (ss unavailable)";
  }
}

/**
 * Pin the Mastra dev server to loopback.
 *
 * `mastra dev` serves Studio AND an unauthenticated tool-execute API. With no
 * `server.host` configured, Mastra hands `hostname: undefined` to the Node
 * listener, which binds EVERY interface while the startup banner still prints
 * "localhost". Measured on origin/main@2d19790:
 *
 *   LISTEN 0 511 *:4111 *:*        +  "Studio: http://localhost:4111"
 *
 * IPI-1231's split entry (`src/mastra/index.ts` only re-exports `getMastra()`)
 * leaves the CLI no `new Mastra({ server })` literal to read, so the documented
 * `server: { host }` config cannot be used here. The installed deployer resolves
 * the bind as `serverOptions?.host ?? process.env.MASTRA_HOST ?? "localhost"`
 * (@mastra/deployer 1.63.2, dist/server/index.js), so MASTRA_HOST is honoured.
 * An explicit operator MASTRA_HOST always wins.
 *
 * Only the agent-port child is affected; the UI child keeps the inherited env.
 */
export function resolveChildEnv(ports, env = process.env) {
  if (!ports.includes(AGENT_PORT)) return env;
  return { ...env, MASTRA_HOST: env.MASTRA_HOST ?? LOOPBACK_HOST };
}

export async function runDevGuard(argv = process.argv.slice(2)) {
  const { ports, command } = parseArgs(argv);

  const busy = [];
  for (const port of ports) {
    if (await portInUse(port)) {
      busy.push(port);
    }
  }

  if (busy.length > 0) {
    for (const port of busy) {
      const role = PORT_ROLE[port] ?? "service";
      const who = describeListener(port);
      console.error(
        `dev-guard: port ${port} (${role}) is already listening [${who}].`,
      );
    }
    console.error(
      "Stop that process before running this command. UI is :3000. Agent is :4111.",
    );
    return 1;
  }

  const child = spawn(command[0], command.slice(1), {
    stdio: "inherit",
    env: resolveChildEnv(ports),
    shell: false,
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => child.kill(sig));
  }

  return await new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  process.exit(await runDevGuard());
}
