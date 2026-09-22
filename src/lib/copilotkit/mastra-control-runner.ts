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

export class MastraControlRunner extends AgentRunner {
  private readonly baseUrl: URL;

  constructor(
    private readonly delegate: AgentRunner,
    baseUrl: string,
    private readonly accessToken: string,
  ) {
    super();
    this.baseUrl = requireHttpBaseUrl(baseUrl);
  }

  run(request: AgentRunnerRunRequest) {
    return this.delegate.run(request);
  }

  connect(request: AgentRunnerConnectRequest) {
    return this.delegate.connect(request);
  }

  private async post(path: string, body: Record<string, string>) {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
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
    const runId = request.runId ?? (await this.activeRunId(request.threadId));
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
