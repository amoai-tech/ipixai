"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import type { PlannerChatMessage } from "@/mastra/thread-types";

function replayErrorMessage(status: number) {
  if (status === 403) {
    return "This conversation is not available for your organization.";
  }
  if (status === 401) {
    return "Sign in required to load this conversation.";
  }
  return "Could not load this conversation. Try again.";
}

function conversationRevision(messages: unknown) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") return "";
      const row = message as { id?: unknown; content?: unknown };
      const id = typeof row.id === "string" ? row.id : "";
      const content =
        typeof row.content === "string"
          ? row.content
          : JSON.stringify(row.content ?? "");
      return JSON.stringify([id, content]);
    })
    .join("\n");
}

export function RestoreMastraHistory({
  threadId,
  replay = true,
  onSettled,
}: {
  threadId: string;
  replay?: boolean;
  /**
   * Fires exactly once per attempt (mount, threadId change, or Retry), after
   * the restore fetch has either applied its messages, failed, or been
   * skipped (revision changed mid-flight) — never on abort (the attempt was
   * superseded, not settled). Optional and additive: /planner doesn't pass
   * it and is unaffected. /app's dock uses it to hold off letting the
   * operator send anything until any restore for an *existing* thread has
   * finished — confirmed live (IPI-1217) that sending while this fetch is
   * still in flight can race agent.setMessages() and silently drop the new
   * message, because nothing previously serialized "restore, then allow
   * interaction" for a thread that already has real history — /planner's
   * own tests never exercise that combination, since they always start a
   * brand-new (replay=false) thread via New.
   */
  onSettled?: () => void;
}) {
  const { agent } = useAgent({ agentId: "default" });
  const agentRef = useRef(agent);
  const baselineRevisionRef = useRef<string | null>(null);
  const onSettledRef = useRef(onSettled);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [restored, setRestored] = useState<PlannerChatMessage[] | null>(null);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    baselineRevisionRef.current = null;
    setRestored(null);
    setError(null);
  }, [threadId]);

  useEffect(() => {
    if (!replay) {
      onSettledRef.current?.();
      return;
    }
    const controller = new AbortController();
    if (baselineRevisionRef.current === null) {
      baselineRevisionRef.current = conversationRevision(
        agentRef.current.messages,
      );
    }
    const startedRevision = baselineRevisionRef.current;
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/planner/threads/${encodeURIComponent(threadId)}/messages`,
          { credentials: "include", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(replayErrorMessage(response.status));
          return;
        }
        const body = (await response.json()) as {
          messages?: unknown;
        };
        if (controller.signal.aborted) return;
        if (body.messages !== undefined && !Array.isArray(body.messages)) {
          setError("Could not load this conversation. Try again.");
          return;
        }
        if (
          conversationRevision(agentRef.current.messages) !== startedRevision
        ) {
          return;
        }
        const messages = (body.messages ?? []) as PlannerChatMessage[];
        agentRef.current.setMessages(messages);
        setRestored(messages);
      } catch {
        if (controller.signal.aborted) return;
        setError("Could not load this conversation. Try again.");
      } finally {
        if (!controller.signal.aborted) onSettledRef.current?.();
      }
    })();
    return () => {
      controller.abort();
    };
  }, [threadId, retryKey, replay]);

  if (!replay) return null;

  return (
    <>
      {restored ? (
        <ol aria-label="Restored conversation" className="sr-only">
          {restored.map((message) => (
            <li key={message.id}>{message.content}</li>
          ))}
        </ol>
      ) : null}
      {error ? (
        <ErrorState
          title="Could not restore conversation"
          message={error}
          onRetry={() => setRetryKey((n) => n + 1)}
        />
      ) : null}
    </>
  );
}
