import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client === null) {
    const isDemoMode = process.env.DEMO_MODE === "true";
    const apiKey = process.env.OPENAI_API_KEY;

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
