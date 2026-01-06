import OpenAI from "openai";

/**
 * OpenAI client factory with lazy initialization.
 * 
 * CRITICAL: Uses Proxy pattern to defer client creation until first property access.
 * This ensures API key validation only runs when the client is actually used,
 * not at module import time. This is essential for DEMO_MODE support:
 * - In DEMO_MODE, openaiWrapper.ts short-circuits before accessing client
 * - Therefore, getClient() is never called in DEMO_MODE
 * - Therefore, API key validation never runs in DEMO_MODE
 * 
 * Without lazy initialization, validation would run at import time, causing
 * errors even when DEMO_MODE is enabled.
 */
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client === null) {
    const isDemoMode = process.env.DEMO_MODE === "true";
    const apiKey = process.env.OPENAI_API_KEY;

    // Only validate API key if not in DEMO_MODE
    // In DEMO_MODE, this function should never be called (wrapper short-circuits first)
    if (!isDemoMode && !apiKey) {
      throw new Error("OPENAI_API_KEY not set in environment");
    }

    _client = new OpenAI({
      apiKey: apiKey || "demo-key",
    });
  }
  return _client;
}

export const client = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return getClient()[prop as keyof OpenAI];
  },
});
