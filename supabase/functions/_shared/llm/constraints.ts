export type GroqChatRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  functions?: unknown;
  function_call?: unknown;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
};

export function assertNoDeprecatedToolApi(body: GroqChatRequest): void {
  if (body.functions !== undefined || body.function_call !== undefined) {
    throw new Error(
      "Groq deprecated functions/function_call — use tools + tool_choice.",
    );
  }
}

export function assertStructuredRequestOptions(body: GroqChatRequest): void {
  const strictJson = body.response_format?.type === "json_schema" &&
    body.response_format.json_schema.strict === true;

  if (!strictJson) return;

  if (body.stream) {
    throw new Error("Groq strict JSON schema cannot be combined with stream:true.");
  }
  if (body.tools?.length) {
    throw new Error("Groq strict JSON schema cannot be combined with tools.");
  }
  if (body.tool_choice !== undefined) {
    throw new Error("Groq strict JSON schema cannot be combined with tool_choice.");
  }
}

export function normalizeCompletionTokenLimit(
  body: GroqChatRequest,
  maxCompletionTokens: number,
): GroqChatRequest {
  if (body.max_tokens !== undefined) {
    throw new Error("Use max_completion_tokens instead of deprecated max_tokens.");
  }
  return {
    ...body,
    max_completion_tokens: body.max_completion_tokens ?? maxCompletionTokens,
  };
}

export function orderPromptMessages(systemPrompt: string, userContent: string) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ] as const;
}
