// Single source of truth for the engine list. Importable from both server
// and client (no SDK imports here) — keep `lib/ai-clients.ts`'s callAIEngine
// switch in sync with this list.
export const DEFAULT_ENGINES = [
  "ChatGPT",
  "Claude",
  "Perplexity",
  "Gemini",
  "Groq",
  "AI Overviews",
] as const;

export type Engine = (typeof DEFAULT_ENGINES)[number];
