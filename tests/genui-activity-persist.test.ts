import { describe, expect, it, vi } from "vitest";

import {
  GenUIActivityCollector,
  capturePlannerGenUIStream,
  plannerRunScope,
  plannerScopeForOrg,
} from "../src/lib/copilotkit/genui-activity-persist";

const create = {
  version: "1.0",
  createSurface: { surfaceId: "comparison-1", catalogId: "ipix/planner@1" },
};
const update = {
  version: "1.0",
  updateComponents: {
    surfaceId: "comparison-1",
    components: [{
      id: "root",
      component: "ConceptComparison",
      title: "Saved comparison",
      options: [
        { name: "Studio", rationale: "Controlled light." },
        { name: "Outdoor", rationale: "Natural light." },
      ],
    }],
  },
};

function event(value: unknown) {
  return `event: message\ndata: ${JSON.stringify(value)}\n\n`;
}

function snapshot(content: Record<string, unknown>, messageId = "message-1") {
  return event({
    type: "ACTIVITY_SNAPSHOT",
    messageId,
    activityType: "generative-ui-surface",
    content,
  });
}

function delta(patch: unknown[], messageId = "message-1") {
  return event({
    type: "ACTIVITY_DELTA",
    messageId,
    activityType: "generative-ui-surface",
    patch,
  });
}

function finished() {
  return event({ type: "RUN_FINISHED", threadId: "test-thread", runId: "run-1" });
}
function acceptedSse() {
  return [
    snapshot({
      surfaceId: "comparison-1",
      target: "planner-comparison",
      catalogId: "ipix/planner@1",
      operations: [create],
      status: "streaming",
      rejected: [],
    }),
    delta([{ op: "add", path: "/operations/-", value: update }]),
    delta([{ op: "replace", path: "/status", value: "ready" }]),
    finished(),
  ].join("");
}

describe("GenUIActivityCollector", () => {
  it("reconstructs the final accepted planner activity across chunk boundaries", () => {
    const collector = new GenUIActivityCollector();
    const text = acceptedSse();
    for (let i = 0; i < text.length; i += 17) collector.push(text.slice(i, i + 17));
    const final = collector.finish();
    expect(final.kind).toBe("activity");
    if (final.kind !== "activity") return;
    expect(final.activity.surfaceId).toBe("comparison-1");
    expect(final.activity.operations).toHaveLength(2);
  });

  it("accepts CRLF-framed SSE across arbitrary chunk boundaries", () => {
    const collector = new GenUIActivityCollector();
    const bytes = acceptedSse().replace(/\n/g, "\r\n");
    for (let i = 0; i < bytes.length; i += 7) collector.push(bytes.slice(i, i + 7));
    expect(collector.finish().kind).toBe("activity");
  });

  it("does not persist failed, foreign-target or rejected activities", () => {
    const failed = new GenUIActivityCollector();
    failed.push(snapshot({
      surfaceId: "comparison-1",
      target: "planner-comparison",
      catalogId: "ipix/planner@1",
      operations: [create, update],
      status: "ready",
      rejected: [{ index: 1, reason: "bad" }],
    }));
    // Rejection invalidates an old saved card with the same surface id.
    failed.push(finished());
    expect(failed.finish()).toMatchObject({ kind: "rejected", surfaceId: "comparison-1" });

    const foreign = new GenUIActivityCollector();
    foreign.push(snapshot({
      surfaceId: "comparison-1",
      target: "chat",
      catalogId: "ipix/planner@1",
      operations: [create, update],
      status: "ready",
      rejected: [],
    }));
    foreign.push(finished());
    expect(foreign.finish().kind).toBe("none");
  });

  it("collects an accepted delta-only update for an existing saved card", () => {
    const collector = new GenUIActivityCollector();
    const amended = {
      ...update,
      updateComponents: {
        ...update.updateComponents,
        components: update.updateComponents.components.map((component) => ({
          ...component,
          title: "Second concept direction",
        })),
      },
    };
    collector.push(delta([{ op: "add", path: "/operations/-", value: amended }]));
    collector.push(delta([{ op: "replace", path: "/status", value: "ready" }]));
    collector.push(finished());
    const result = collector.finish();
    expect(result).toMatchObject({
      kind: "update", surfaceId: "comparison-1", operations: [amended],
    });
  });

  it("never clears a newly created card when an older card is deleted later", () => {
    const collector = new GenUIActivityCollector();
    collector.push(snapshot({
      surfaceId: "comparison-1", target: "planner-comparison",
      catalogId: "ipix/planner@1", operations: [create, update],
      status: "ready", rejected: [],
    }));
    collector.push(delta([{
      op: "add", path: "/operations/-",
      value: { version: "1.0", deleteSurface: { surfaceId: "older-card" } },
    }], "old-msg"));
    collector.push(finished());
    expect(collector.finish()).toMatchObject({
      kind: "activity", activity: { surfaceId: "comparison-1" },
    });
  });

  it("never persists a ready card from a failed or truncated run", () => {
    const contents = {
      surfaceId: "comparison-1", target: "planner-comparison",
      catalogId: "ipix/planner@1", operations: [create, update],
      status: "ready", rejected: [],
    };
    const truncated = new GenUIActivityCollector();
    truncated.push(snapshot(contents));
    expect(truncated.finish().kind).toBe("none");
    const errored = new GenUIActivityCollector();
    errored.push(snapshot(contents));
    errored.push(event({ type: "RUN_ERROR", message: "provider failed" }));
    errored.push(finished());
    expect(errored.finish().kind).toBe("none");
  });

  it("records a delete only for the planner surface", () => {
    const deleted = new GenUIActivityCollector();
    deleted.push(snapshot({
      surfaceId: "comparison-1",
      target: "planner-comparison",
      catalogId: "ipix/planner@1",
      operations: [create, update],
      status: "streaming",
      rejected: [],
    }));
    deleted.push(delta([{ op: "add", path: "/operations/-", value: { version: "1.0", deleteSurface: { surfaceId: "comparison-1" } } }]));
    deleted.push(finished());
    expect(deleted.finish().kind).toBe("delete");
  });
});

describe("capturePlannerGenUIStream", () => {
  it("passes SSE bytes through unchanged and persists the accepted activity", async () => {
    const payload = acceptedSse();
    const encoded = new TextEncoder().encode(payload);
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoded.slice(0, 40));
        controller.enqueue(encoded.slice(40));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
    const save = vi.fn(async (_activity: unknown) => undefined);
    const captured = capturePlannerGenUIStream(response, {
      save,
    });
    const text = await new Response(captured.body).text();
    expect(text).toBe(payload);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      kind: "activity",
      activity: { surfaceId: "comparison-1" },
    });
  });
});


describe("Planner scope identity for stored GenUI", () => {
  const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const brand = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  it("accepts the authenticated workspace and same-org Brand/Shoot locators", () => {
    expect(plannerScopeForOrg("workspace", org)).toBe("workspace");
    expect(plannerScopeForOrg(`brand:${org}:${brand}`, org)).toBe(`brand:${org}:${brand}`);
    expect(plannerScopeForOrg(`shoot:${org}:${brand}`, org)).toBe(`shoot:${org}:${brand}`);
  });
  it("rejects foreign-org, invalid and missing scope values", () => {
    expect(plannerScopeForOrg(`brand:foreign:${brand}`, org)).toBeNull();
    expect(plannerScopeForOrg(`shoot:${org}:invalid`, org)).toBeNull();
    expect(plannerScopeForOrg(undefined, org)).toBeNull();
  });
  it("extracts the actual forwarded context while rejecting a forged org", () => {
    const context = [{ description: "Current Brand", value: { scopeKey: `brand:${org}:${brand}` } }];
    expect(plannerRunScope({ context }, org)).toBe(`brand:${org}:${brand}`);
    expect(plannerRunScope({ context }, "another-org")).toBeNull();
    expect(plannerRunScope({ context: [{ value: JSON.stringify({ scopeKey: "workspace" }) }] }, org)).toBe("workspace");
    expect(plannerRunScope({ context: [] }, org)).toBeNull();
  });
});
