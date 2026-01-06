# AI Prompt Security CI

Automatically runs defensive prompt-based security checks (jailbreak, prompt leak, harmful requests) against your AI models during CI/CD.

## Key Features
- CLI + GitHub Action
- Heuristic + optional LLM-as-judge evaluation (runs when heuristics are inconclusive)
- JSON + Markdown security reports
- DEMO_MODE (zero-API-cost testing, no API key needed)
- Sanitized outputs (tokens redacted, content truncated)
- maxCalls & fail_on_high flags
- Safe, defensive-only attack library (3 example attacks in Phase-1)

## What This Tool Does NOT Do (Phase-1 MVP)
- ❌ No dashboard (JSON/Markdown reports only)
- ❌ No SaaS backend (fully local/CI execution)
- ❌ No multi-turn attacks (single message per attack)
- ❌ No inference-time guards (tests prompts only)
- ❌ No billing/payment (users pay for their own OpenAI API usage)
- ❌ No enterprise features (no team collaboration or historical tracking)

## Usage
See README.md for installation and configuration instructions.

**Note:** This is a Phase-1 MVP. When DEMO_MODE is off, you will be charged for OpenAI API usage based on your model and token consumption.

