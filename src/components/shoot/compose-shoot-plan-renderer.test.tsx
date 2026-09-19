// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

const copilot = vi.hoisted(() => ({
  config: null as null | { name: string; render: (props: unknown) => unknown },
  agent: { isRunning: false, addMessage: vi.fn() },
  runAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  useRenderTool: (config: { name: string; render: (props: unknown) => unknown }) => {
    copilot.config = config;
  },
  useAgent: () => ({ agent: copilot.agent }),
  useCopilotKit: () => ({ copilotkit: { runAgent: copilot.runAgent } }),
}));

import { ComposeShootPlanRenderer } from "./compose-shoot-plan-renderer";

const COMPLETE_PLAN = {
  status: "complete",
  channels: ["shopify"],
  objective: { status: "confirmed", value: "Launch the spring capsule", source: "operator" },
  shotListResult: null,
  deliverablesResult: {
    status: "ok",
    missingInputs: [],
    assumptions: [],
    warnings: [],
    totalAssets: 6,
    deliverables: [
      { channel: "shopify", format: "1:1 JPG", formatSource: "ipix_default_v1", quantity: 6, source: "ipix_default_v1", assumed: true },
    ],
  },
  missingInputs: [],
  warnings: [],
};

beforeEach(() => {
  copilot.config = null;
  copilot.agent.isRunning = false;
  copilot.agent.addMessage.mockClear();
  copilot.runAgent.mockClear();
});

afterEach(() => {
  cleanup();
});

function renderResult(status: string, result?: string): ReactElement {
  render(<ComposeShootPlanRenderer />);
  const config = copilot.config;
  if (!config) throw new Error("useRenderTool was not registered");
  expect(config.name).toBe("composeShootPlan");
  return config.render({ status, parameters: {}, result }) as ReactElement;
}

describe("ComposeShootPlanRenderer", () => {
  it("registers the named renderer for composeShootPlan", () => {
    render(<ComposeShootPlanRenderer />);
    expect(copilot.config?.name).toBe("composeShootPlan");
  });

  it("shows a pending state while the tool call is still in progress or executing", () => {
    render(renderResult("inProgress"));
    expect(screen.getByTestId("compose-shoot-plan-pending")).toBeTruthy();
    cleanup();

    render(renderResult("executing"));
    expect(screen.getByTestId("compose-shoot-plan-pending")).toBeTruthy();
  });

  it("renders the structured card from a completed real result", () => {
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    expect(screen.getByTestId("compose-shoot-plan-card")).toBeTruthy();
    expect(screen.getByTestId("compose-shoot-plan-objective").textContent).toBe(
      "Launch the spring capsule",
    );
  });

  it("falls back safely instead of crashing on an unparsable result", () => {
    render(renderResult("complete", "not json"));
    expect(screen.getByTestId("compose-shoot-plan-unreadable")).toBeTruthy();
  });

  it("falls back safely on a result that isn't shaped like a ShootPlan", () => {
    render(renderResult("complete", JSON.stringify({ unrelated: true })));
    expect(screen.getByTestId("compose-shoot-plan-unreadable")).toBeTruthy();
  });
});

describe("ComposeShootPlanRenderer — Review Shoot Plan (IPI-1242)", () => {
  it("clicking Review Shoot Plan sends a review request into the same agent/thread", () => {
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    fireEvent.click(screen.getByTestId("compose-shoot-plan-review-button"));

    expect(copilot.agent.addMessage).toHaveBeenCalledTimes(1);
    const [message] = copilot.agent.addMessage.mock.calls[0] as [{ role: string; content: string }];
    expect(message.role).toBe("user");
    expect(message.content).toMatch(/review/i);
    expect(copilot.runAgent).toHaveBeenCalledTimes(1);
    expect(copilot.runAgent).toHaveBeenCalledWith({ agent: copilot.agent });
  });

  it("does not start a second review run while the agent is already running", () => {
    copilot.agent.isRunning = true;
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    fireEvent.click(screen.getByTestId("compose-shoot-plan-review-button"));

    expect(copilot.agent.addMessage).not.toHaveBeenCalled();
    expect(copilot.runAgent).not.toHaveBeenCalled();
  });

  it("ignores a synchronous second click while the first review request is still in flight", async () => {
    let resolveRunAgent: (() => void) | undefined;
    copilot.runAgent.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveRunAgent = resolve; }),
    );
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    const button = screen.getByTestId("compose-shoot-plan-review-button");

    fireEvent.click(button);
    fireEvent.click(button);

    expect(copilot.agent.addMessage).toHaveBeenCalledTimes(1);
    expect(copilot.runAgent).toHaveBeenCalledTimes(1);

    resolveRunAgent?.();
    await Promise.resolve();
  });

  it("allows a new review run after the previous request rejects", async () => {
    let rejectRunAgent: ((reason: unknown) => void) | undefined;
    copilot.runAgent.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectRunAgent = reject; }),
    );
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    const button = screen.getByTestId("compose-shoot-plan-review-button");

    fireEvent.click(button);
    rejectRunAgent?.(new Error("run failed"));
    await Promise.resolve();
    await Promise.resolve();

    copilot.runAgent.mockResolvedValueOnce(undefined);
    fireEvent.click(button);

    expect(copilot.agent.addMessage).toHaveBeenCalledTimes(2);
    expect(copilot.runAgent).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight guard if addMessage throws synchronously, so the next click still works", () => {
    copilot.agent.addMessage.mockImplementationOnce(() => {
      throw new Error("addMessage failed");
    });
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    const button = screen.getByTestId("compose-shoot-plan-review-button");

    // React 19 both rethrows synchronously to the caller (caught below) and
    // reports the same error via the window `error` event; swallow that
    // second report so it doesn't register as an unhandled test error.
    const swallowReportedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", swallowReportedError);
    try {
      fireEvent.click(button);
    } catch {
      // Expected: the handler rethrows after resetting the guard.
    } finally {
      window.removeEventListener("error", swallowReportedError);
    }
    expect(copilot.runAgent).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(copilot.agent.addMessage).toHaveBeenCalledTimes(2);
    expect(copilot.runAgent).toHaveBeenCalledTimes(1);
  });

  it("names the reviewed plan's objective/channels/counts so a click doesn't get conflated with another card", () => {
    render(renderResult("complete", JSON.stringify(COMPLETE_PLAN)));
    fireEvent.click(screen.getByTestId("compose-shoot-plan-review-button"));

    const [message] = copilot.agent.addMessage.mock.calls[0] as [{ content: string }];
    expect(message.content).toContain("Launch the spring capsule");
    expect(message.content).toContain("shopify");
    expect(message.content).toContain("6 deliverables");
  });
});
