"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const openai_1 = __importDefault(require("openai"));
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
let _client = null;
function getClient() {
    if (_client === null) {
        const isDemoMode = process.env.DEMO_MODE === "true";
        const apiKey = process.env.OPENAI_API_KEY;
        // Only validate API key if not in DEMO_MODE
        // In DEMO_MODE, this function should never be called (wrapper short-circuits first)
        if (!isDemoMode && !apiKey) {
            throw new Error("OPENAI_API_KEY not set in environment");
        }
        _client = new openai_1.default({
            apiKey: apiKey || "demo-key",
        });
    }
    return _client;
}
exports.client = new Proxy({}, {
    get(_target, prop) {
        return getClient()[prop];
    },
});
