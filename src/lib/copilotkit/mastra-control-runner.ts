import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerIsRunningRequest,
  type AgentRunnerRunRequest,
  type AgentRunnerStopRequest,
} from "@copilotkit/runtime/v2";

function requireHttpBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MASTRA_BASE_URL must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MASTRA_BASE_URL must use http or https");
  }
  return url;
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} failed: ${response.status}`);
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

type RunControlPath =
  | "/ipix/run-control/active"
  | "/ipix/run-control/abort";

const RUN_CONTROL_TIMEOUT_MS = 10_000;

/**
 * Absolute control URL for `path`, preserving any base-path prefix on `base`.
 *
 * The base href is slash-normalized first because `new URL()` resolves a
 * relative path against the *last* segment of the base: with a base of
 * `https://host/runtime` the control path would resolve to
 * `https://host/ipix/...`, silently dropping the prefix so every
 * cross-instance stop 404s. Forcing a trailing slash keeps it:
 * `https://host/runtime/` + `ipix/...` -> `https://host/runtime/ipix/...`.
 */
function controlUrl(base: URL, path: RunControlPath): URL {
  const prefix = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(path.replace(/^\//, ""), prefix);
}

export class MastraControlRunner extends AgentRunner {
  /** Resolved once per runner: both control endpoints are fixed literals. */
  private readonly controlUrls: Readonly<Record<RunControlPath, URL>>;

  constructor(
    private readonly delegate: AgentRunner,
    baseUrl: string,
    private readonly accessToken: string,
  ) {
    super();
    const base = requireHttpBaseUrl(baseUrl);
    this.controlUrls = {
      "/ipix/run-control/active": controlUrl(base, "/ipix/run-control/active"),
      "/ipix/run-control/abort": controlUrl(base, "/ipix/run-control/abort"),
    };
  }

  run(request: AgentRunnerRunRequest) {
    return this.delegate.run(request);
  }

  connect(request: AgentRunnerConnectRequest) {
    return this.delegate.connect(request);
  }

  private async post(path: RunControlPath, body: Record<string, string>) {
    return fetch(this.controlUrls[path], {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RUN_CONTROL_TIMEOUT_MS),
    });
  }

  private async activeRunId(threadId: string): Promise<string | undefined> {
    const response = await this.post("/ipix/run-control/active", { threadId });
    const body = await readJson<{ runId?: unknown }>(response, "Active run lookup");
    if (body.runId == null) return undefined;
    if (typeof body.runId !== "string") {
      throw new Error("Active run lookup returned an invalid payload");
    }
    return body.runId;
  }

  async isRunning(request: AgentRunnerIsRunningRequest): Promise<boolean> {
    return Boolean(await this.activeRunId(request.threadId));
  }

  async stop(request: AgentRunnerStopRequest): Promise<boolean> {
    const runId = request.runId;
    if (!runId) return false;
    const response = await this.post("/ipix/run-control/abort", {
      threadId: request.threadId,
      runId,
    });
    const body = await readJson<{ aborted?: unknown }>(response, "Run abort");
    if (typeof body.aborted !== "boolean") {
      throw new Error("Run abort returned an invalid payload");
    }
    return body.aborted;
  }
}
