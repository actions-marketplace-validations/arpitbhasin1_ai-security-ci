"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const openai_1 = __importDefault(require("openai"));
let _client = null;
function getClient() {
    if (_client === null) {
        const isDemoMode = process.env.DEMO_MODE === "true";
        const apiKey = process.env.OPENAI_API_KEY;
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
