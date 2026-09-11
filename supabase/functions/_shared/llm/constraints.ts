export function orderPromptMessages(systemPrompt: string, userContent: string) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ] as const;
}
