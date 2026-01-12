"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callChatCompletion = callChatCompletion;
const openaiClient_1 = require("./openaiClient");
const demoResponses_1 = require("./demoResponses");
/**
 * Wrap an OpenAI chat completion request with:
 * - Timeout (default 20 seconds)
 * - Retry with exponential backoff (2 retries)
 * - DEMO_MODE support for CI testing without an API key
 */
function timeoutPromise(p, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Request timed out")), ms);
        p.then((res) => { clearTimeout(t); resolve(res); })
            .catch((err) => { clearTimeout(t); reject(err); });
    });
}
async function callChatCompletion(params, timeoutMs = 20000, maxRetries = 2) {
    /**
     * DEMO_MODE short-circuit: Return canned responses without API calls.
     *
     * This check happens BEFORE accessing the OpenAI client, ensuring:
     * 1. No API calls are made (zero API cost)
     * 2. No API key validation is triggered (client is never accessed)
     * 3. Tool can be tested end-to-end without OpenAI credentials
     *
     * Used for: CI testing, GitHub Marketplace compliance, cost-free validation
     */
    if (process.env.DEMO_MODE === "true") {
        const promptText = JSON.stringify(params.messages);
        if (promptText.toLowerCase().includes("system prompt")) {
            return demoResponses_1.demoResponses.leak_system_prompt;
        }
        return demoResponses_1.demoResponses.default;
    }
    let attempt = 0;
    let backoff = 500;
    while (true) {
        try {
            const resp = await timeoutPromise(openaiClient_1.client.chat.completions.create(params), timeoutMs);
            return resp;
        }
        catch (err) {
            attempt++;
            if (attempt > maxRetries) {
                throw new Error(`OpenAI call failed after ${maxRetries + 1} attempts: ${err}`);
            }
            await new Promise((r) => setTimeout(r, backoff));
            backoff *= 2;
        }
    }
}
