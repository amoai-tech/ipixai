import { describe, it, expect, vi } from "vitest";
import { HttpAgent } from "@ag-ui/client";
import { capturePlannerGenUIStream } from "../src/lib/copilotkit/genui-activity-persist";

describe("AG-UI client terminal event is a durability outcome", () => {
  it("sends RUN_ERROR instead of RUN_FINISHED when the save fails", async () => {
    const upstream = new Response(
      'data: {"type":"RUN_STARTED","threadId":"a","runId":"b"}\n\n' +
      'data: {"type":"ACTIVITY_SNAPSHOT","messageId":"m","activityType":"generative-ui-surface","content":{"surfaceId":"card-1","target":"planner-comparison","catalogId":"ipix/planner@1","operations":[{"version":"1.0","createSurface":{"surfaceId":"card-1","catalogId":"ipix/planner@1"}},{"version":"1.0","updateComponents":{"surfaceId":"card-1","components":[{"id":"root","component":"ConceptComparison","title":"Compare","options":[{"name":"Studio","rationale":"Indoor"},{"name":"Outdoor","rationale":"Light"}]}]}}],"status":"ready","rejected":[]}}\n\n' +
      'data: {"type":"RUN_FINISHED","threadId":"a","runId":"b"}\n\n',
      {headers: {"content-type":"text/event-stream"}}
    );
    const failed = vi.fn();
    const finished = vi.fn();
    const agent = new HttpAgent({url:"http://local.test",fetch:async()=>capturePlannerGenUIStream(upstream,{save:async()=>{throw Error("save failed")}})});
    agent.subscribe({
      onRunErrorEvent: ({event}) => failed(event.code),
      onRunFinishedEvent: () => finished(),
    });
    await agent.runAgent({runId:"b"});
    expect(failed).toHaveBeenCalledWith("GENUI_PERSIST_FAILED");
    expect(finished).not.toHaveBeenCalled();
  });

  it("forwards a successful terminal event unmodified when no card needs saving", async () => {
    const upstream = new Response(
      'data: {"type":"RUN_STARTED","threadId":"a","runId":"b"}\n\n' +
      'data: {"type":"RUN_FINISHED","threadId":"a","runId":"b"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
    const finished = vi.fn();
    const error = vi.fn();
    const agent = new HttpAgent({
      url: "http://local.test",
      fetch: async () => capturePlannerGenUIStream(upstream, {
        save: async () => { throw new Error("not called"); },
      }),
    });
    agent.subscribe({
      onRunFinishedEvent: () => finished(),
      onRunErrorEvent: () => error(),
    });
    await agent.runAgent({ runId: "b" });
    expect(finished).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });
});
