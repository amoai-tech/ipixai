"use client";

import { ProverbsCard } from "@/components/proverbs";
import { WeatherCard } from "@/components/weather";
import { MoonCard } from "@/components/moon";
import type { AgentState } from "@/lib/types";
import {
  useAgent,
  useConfigureSuggestions,
  useFrontendTool,
  useHumanInTheLoop,
  CopilotKit,
  CopilotSidebar,
  CopilotChatConfigurationProvider,
} from "@copilotkit/react-core/v2";
import { AuthBar } from "@/components/auth-bar";
import { PlannerThreadsDrawer } from "@/components/planner-threads-drawer";
import { RestoreMastraHistory } from "@/components/restore-mastra-history";
import { copilotHandshake } from "@/lib/auth/copilot-mount";
import { usePlannerAuth } from "@/lib/auth/use-planner-auth";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import styles from "./page.module.css";

export function PlannerApp() {
  const authState = usePlannerAuth();
  const { mountCopilotKit } = copilotHandshake(authState);

  if (!mountCopilotKit) {
    if (authState === "loading") {
      return <p>Loading…</p>;
    }
    return (
      <p>
        Sign in required. <a href="/login">Sign in</a>
      </p>
    );
  }

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      publicLicenseKey={process.env.NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY}
    >
      <PlannerSurface />
    </CopilotKit>
  );
}

function PlannerSurface() {
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [replay, setReplay] = useState(true);
  const onThreadId = useCallback(
    (id: string, selection: { threadId: string; replay: boolean }) => {
      setThreadId(id);
      setReplay(selection.replay);
    },
    [],
  );

  useFrontendTool({
    name: "setThemeColor",
    parameters: z.object({
      themeColor: z
        .string()
        .describe("The theme color to set. Make sure to pick nice colors."),
    }),
    handler: async ({ themeColor }) => {
      setThemeColor(themeColor);
      return `Changing theme color to ${themeColor}`;
    },
  });

  useConfigureSuggestions({
    available: "always",
    suggestions: [
      {
        title: "Generative UI",
        message: "Get the weather in San Francisco.",
      },
      {
        title: "Frontend Tools",
        message: "Set the theme to green.",
      },
      {
        title: "Human In the Loop",
        message: "Please go to the moon.",
      },
      {
        title: "Write Agent State",
        message: "Add a proverb about AI.",
      },
      {
        title: "Update Agent State",
        message:
          "Please remove 1 random proverb from the list if there are any.",
      },
      {
        title: "Read Agent State",
        message: "What are the proverbs?",
      },
    ],
  });

  return (
    <CopilotChatConfigurationProvider agentId="default">
      <div className={`${styles.layout} threadsLayout`}>
        <PlannerThreadsDrawer threadId={threadId} onThreadId={onThreadId} />
        <div className={styles.mainPanel}>
          <AuthBar />
          {threadId && replay ? (
            <div className={styles.replayBanner}>
              <RestoreMastraHistory threadId={threadId} replay={replay} />
            </div>
          ) : null}
          <main
            className={styles.mainScroll}
            style={
              {
                "--copilot-kit-primary-color": themeColor,
              } as React.CSSProperties
            }
          >
            <YourMainContent themeColor={themeColor} />
            {threadId ? (
              <CopilotSidebar
                defaultOpen={false}
                threadId={threadId}
                labels={{
                  modalHeaderTitle: "Popup Assistant",
                  welcomeMessageText:
                    "👋 Hi, there! You're chatting with an agent.",
                }}
              />
            ) : (
              <p role="status">Loading conversation…</p>
            )}
          </main>
        </div>
      </div>
    </CopilotChatConfigurationProvider>
  );
}

function YourMainContent({ themeColor }: { themeColor: string }) {
  const { agent } = useAgent({ agentId: "default" });
  const state = (agent.state as AgentState | undefined) ?? { proverbs: [] };
  const setState = (next: AgentState) => agent.setState(next);

  useEffect(() => {
    if ((agent.state as AgentState | undefined)?.proverbs === undefined) {
      agent.setState({
        proverbs: [
          "CopilotKit may be new, but it's the best thing since sliced bread.",
        ],
      });
    }
  }, [agent]);

  useFrontendTool(
    {
      name: "weatherTool",
      description: "Get the weather for a given location.",
      available: false,
      parameters: z.object({
        location: z.string(),
      }),
      render: ({ args }) => {
        return <WeatherCard location={args.location} themeColor={themeColor} />;
      },
    },
    [themeColor],
  );

  useHumanInTheLoop(
    {
      name: "go_to_moon",
      description: "Go to the moon on request.",
      render: ({ respond, status }) => {
        return (
          <MoonCard themeColor={themeColor} status={status} respond={respond} />
        );
      },
    },
    [themeColor],
  );

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-screen flex justify-center items-center flex-col transition-colors duration-300"
    >
      <ProverbsCard state={state} setState={setState} />
    </div>
  );
}
