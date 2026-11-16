import { describe, expect, it, vi } from "vitest";

import {
  GenUIActivityCollector,
  capturePlannerGenUIStream,
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
    expect(failed.finish().kind).toBe("none");

    const foreign = new GenUIActivityCollector();
    foreign.push(snapshot({
      surfaceId: "comparison-1",
      target: "chat",
      catalogId: "ipix/planner@1",
      operations: [create, update],
      status: "ready",
      rejected: [],
    }));
    expect(foreign.finish().kind).toBe("none");
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
      threadId: "thread-a",
      save,
    });
    const text = await new Response(captured.body).text();
    expect(text).toBe(payload);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ surfaceId: "comparison-1" });
  });
});
