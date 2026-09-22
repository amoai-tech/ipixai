import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerIsRunningRequest,
  type AgentRunnerRunRequest,
  type AgentRunnerStopRequest,
} from "@copilotkit/runtime/v2";

export class MastraControlRunner extends AgentRunner {
  constructor(
    private readonly delegate: AgentRunner,
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {
    super();
  }

  run(request: AgentRunnerRunRequest) {
    return this.delegate.run(request);
  }

  connect(request: AgentRunnerConnectRequest) {
    return this.delegate.connect(request);
  }

  private async post(path: string, body: Record<string, string>) {
    return fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
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
    if (!response.ok) return undefined;
    const body = (await response.json()) as { runId?: string | null };
    return body.runId || undefined;
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
    if (!response.ok) return false;
    const body = (await response.json()) as { aborted?: boolean };
    return body.aborted === true;
  }
}
