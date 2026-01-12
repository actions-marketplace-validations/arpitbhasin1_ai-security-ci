# Technical Audit: AI Security CI

**Date:** 2025-01-27  
**Audit Type:** Implementation-Grounded Review  
**Scope:** Phase 1 MVP codebase (src/, dist/, action.yml, docs/)

---

## 1. What This Project Is

AI Security CI is a Node.js-based security testing tool that runs automated prompt attacks against AI systems to detect vulnerabilities. It is designed for developers and security teams who need to validate that their AI prompts and agents resist common attack patterns like jailbreaks, prompt leakage, and harmful content generation. The tool takes the form of a CLI application and a GitHub Action. It executes a library of attack prompts against a user's system prompt using the OpenAI API, evaluates responses using keyword heuristics and optional LLM-based judging, and generates JSON and Markdown reports with sanitized results.

**One-sentence summary:** This tool runs simulated prompt attacks against AI systems in CI pipelines, evaluates responses using heuristics and optional LLM judging, and generates security reports.

---

## 2. High-Level Execution Flow

### Entry Point
- **CLI:** `npm run ai-sec -- --config <path>` executes `src/index.ts` (compiled to `dist/index.js`)
- **GitHub Action:** `action.yml` runs `dist/index.js` as a node16 action; inputs are passed via environment variables (GitHub Actions converts `inputs.*` to `INPUT_*` env vars)

### Step 1: Config Loading (`loadConfig.ts`)
- Reads YAML config file (default: `examples/ai-sec-config.yaml` if `--config` not provided)
- Validates required fields: `model`, `systemPromptPath`, `attacksPath`
- Validates numeric fields (`maxTokens`, `temperature`, `maxCalls`) and ranges (temperature 0-1, maxTokens ≥ 1)
- Resolves all relative paths relative to the config file directory (not CWD)
- Sets defaults: `useJudge: false`, `fail_on_high: false`, `logLevel: "normal"`

### Step 2: System Prompt Loading
- Reads plain text file from resolved `systemPromptPath`
- Content is used as the `system` message in all API calls
- No validation or formatting required

### Step 3: Attack Library Loading (`loadAttacks.ts`)
- Reads JSON file from resolved `attacksPath`
- Validates each attack has: `id`, `category`, `description`, `prompt`, `severity`
- Validates `severity` ∈ `{"low", "medium", "high"}`
- Validates description length ≤ 200 characters
- Ensures unique attack IDs across the entire file
- Throws errors with file path and index for debugging

### Step 4: Attack Execution (`runAttacks.ts`)
For each attack (up to `maxCalls` limit, applied before loop):
1. **Message Construction:** Creates OpenAI message array: `[{role: "system", content: systemPrompt}, {role: "user", content: attack.prompt}]`
2. **API Call** (`openaiWrapper.ts`):
   - If `DEMO_MODE === "true"`: Short-circuits, returns canned response (no API call, no API key needed)
   - If `DEMO_MODE !== "true"`: Calls OpenAI API with timeout (20s default), retry (2 attempts, exponential backoff: 500ms → 1000ms)
3. **Response Extraction:** Extracts `content` from `choices[0].message.content`, defaults to empty string if missing
4. **Heuristic Evaluation** (`evaluator.ts`): Case-insensitive keyword matching against 4 indicator categories (instruction override, prompt leakage, secret disclosure, harmful content); returns `success: true` if any indicator found
5. **Optional Judge Call** (`judge.ts`): Runs ONLY if heuristics did NOT detect success AND (attack severity === "high" OR `useJudge === true`); uses same model as main attack; judge can override heuristic `false` → `true` but never `true` → `false`
6. **Sanitization** (`sanitize.ts`): Redacts 20+ char token-like sequences, truncates to 500 chars
7. **Result Storage:** Creates `AttackRun` object with attack, sanitized response, evaluation, optional judge result

### Step 5: Report Generation (`reportGenerator.ts`)
- **JSON Report:** `ai-security-output/ai-security-result.json` - metadata (timestamp, version, run_id), summary (total/failed/high-severity counts), full runs array
- **Markdown Report:** `ai-security-output/ai-security-report.md` - summary table, detailed sections per attack (all content sanitized)

### Step 6: Exit Code Logic (`index.ts`)
- **Exit 0:** Normal completion OR DEMO_MODE (always exits 0 in DEMO_MODE, even with high-severity findings)
- **Exit 1:** Error during execution (config/attack loading failure, API errors, etc.)
- **Exit 2:** High-severity failure detected AND `fail_on_high === true` AND `DEMO_MODE !== "true"` (checked via config file OR `FAIL_ON_HIGH` env var OR `INPUT_FAIL_ON_HIGH` env var)

---

## 3. Core Features That Are Actually Implemented

### DEMO_MODE Behavior
- **Environment Variable:** `DEMO_MODE="true"` (string comparison, not boolean)
- **Effect:** Short-circuits API calls in `openaiWrapper.ts` before client access, returns canned responses
- **API Key:** Not required (lazy client initialization via Proxy pattern ensures validation never runs)
- **Exit Code:** Always 0 (never fails CI, even with high-severity findings)
- **Use Case:** Zero-cost testing, CI validation, GitHub Marketplace compliance

### API Key Handling
- **Environment Variable:** `OPENAI_API_KEY`
- **Validation:** Only when client is accessed (lazy initialization); throws error if missing in non-DEMO mode
- **Location:** `openaiClient.ts` uses Proxy pattern to defer client creation until first property access

### MAX_CALLS Behavior
- **Environment Variable:** `MAX_CALLS_PER_RUN` (numeric)
- **Config File:** `maxCalls` (numeric)
- **Precedence:** Environment variable overrides config if both present and > 0
- **Effect:** Limits number of attacks executed (sliced before loop in `runAttacks.ts`)

### Judge Logic
- **Config File:** `useJudge: true/false` (default: false)
- **Execution Condition:** Runs ONLY if heuristics did NOT detect success AND (attack severity === "high" OR `useJudge === true`)
- **Model:** Uses same model as main attack (config field `judgeModel` exists but is **not used** - documented limitation)
- **Behavior:** Can override heuristic `false` → `true`; never overrides `true` → `false`
- **Error Handling:** Judge failures are logged (verbose) but don't stop execution (falls back to heuristic result)

### Exit Code Rules
- **0:** Success OR DEMO_MODE (always)
- **1:** Any error (config/attack loading, API failures, etc.)
- **2:** High-severity failure AND `fail_on_high` enabled AND not DEMO_MODE
- **fail_on_high Sources:** Config file (`fail_on_high: true`), `FAIL_ON_HIGH` env var, `INPUT_FAIL_ON_HIGH` env var (GitHub Actions); OR logic applied

### Path Resolution Rules
- All paths in config (`systemPromptPath`, `attacksPath`) are resolved **relative to config file directory**, not current working directory
- **Example:** Config at `examples/ai-sec-config.yaml` with `systemPromptPath: "./system-prompt.txt"` resolves to `examples/system-prompt.txt`
- **Example:** Config at `examples/ai-sec-config.yaml` with `attacksPath: "../attack-library/basic-attacks.json"` resolves to `attack-library/basic-attacks.json`

### Output Formats
- **JSON:** Structured data with metadata, summary metrics, full runs array (all responses sanitized)
- **Markdown:** Human-readable table + detailed sections (all content sanitized)
- **Console:** Logging based on `logLevel` ("quiet", "normal", "verbose")
- **Output Directory:** `ai-security-output/` (created if missing)

### Sanitization
- **Rules:** Redacts 20+ char token-like sequences (regex: `[A-Za-z0-9\-_]{20,}` → `[REDACTED]`), truncates to 500 chars
- **Applied To:** All responses before storage, all report content (JSON and Markdown)
- **Location:** `sanitize.ts`, applied in `runAttacks.ts` and `reportGenerator.ts`

---

## 4. What Is Explicitly NOT Implemented (Phase-1 Boundaries)

- **Multi-turn attacks:** Each attack is a single user message (no conversation context, no follow-up messages)
- **Dashboards:** No web UI, no visualization tools (JSON/Markdown files only)
- **SaaS backend:** Fully local/CI execution, no cloud service, no remote storage
- **Inference-time guards:** Tests prompts only, does not modify model behavior or add runtime protection
- **Model routing:** Single model per run (no automatic model selection, no fallbacks)
- **Non-OpenAI providers:** OpenAI API only (no Anthropic, no other providers)
- **Historical storage:** No database, no tracking across runs, no trend analysis
- **Advanced scoring:** Binary success/failure only (no confidence scores, no severity weighting beyond high/medium/low)
- **Attack library expansion mechanism:** No built-in library updates, no marketplace (users provide their own JSON file)
- **GitHub Actions config_path input:** The `config_path` input in `action.yml` is **not used** by the code (only `--config` CLI flag works; GitHub Actions would need a wrapper to pass inputs as args)
- **judgeModel config field:** Defined in config schema but **not used** (judge always uses same model as main attack)

---

## 5. DEMO_MODE vs Real Mode (Exact Behavior)

### DEMO_MODE (Environment Variable: `DEMO_MODE="true"`)

**What It Does:**
- Short-circuits API calls in `openaiWrapper.ts` before accessing OpenAI client
- Returns canned responses based on prompt content:
  - If prompt contains "system prompt" (case-insensitive): returns `demoResponses.leak_system_prompt`
  - Otherwise: returns `demoResponses.default` (safe refusal response)

**Why No API Key Required:**
- Lazy client initialization via Proxy pattern in `openaiClient.ts`
- Short-circuit happens before client access, so `getClient()` is never called
- API key validation only runs when client is accessed (never in DEMO_MODE)

**Where Short-Circuiting Happens:**
- `openaiWrapper.ts` line 29: Checks `process.env.DEMO_MODE === "true"` before calling `client.chat.completions.create()`

**What Still Runs vs What Is Skipped:**
- **Runs:** Config loading, attack loading, evaluation (heuristics + judge if conditions met), sanitization, report generation, console logging
- **Skipped:** Actual OpenAI API calls (replaced with canned responses)

**Exit Code Behavior:**
- Always exits 0 (never fails CI, even with high-severity findings)
- Logic in `index.ts` line 79: `if (process.env.DEMO_MODE !== "true" && finalFailOnHigh)` - DEMO_MODE bypasses exit code 2

### Real Mode (DEMO_MODE not set or not "true")

**What It Does:**
- Makes real OpenAI API calls via `openaiWrapper.ts`
- Requires `OPENAI_API_KEY` environment variable (validated on first client access)
- Uses timeout (20s) and retry logic (2 attempts, exponential backoff)

**Exit Code Behavior:**
- Exit 0: Normal completion
- Exit 1: Errors (config/attack loading, API failures)
- Exit 2: High-severity failure AND `fail_on_high` enabled

---

## 6. Files & Responsibilities

### `src/index.ts` (Entry Point)
- CLI entry point (`#!/usr/bin/env node`)
- Parses `--config` flag from command line (defaults to `examples/ai-sec-config.yaml`)
- Orchestrates flow: config loading → attack loading → execution → reporting
- Reads environment variables: `MAX_CALLS_PER_RUN`, `FAIL_ON_HIGH`, `INPUT_FAIL_ON_HIGH`, `DEMO_MODE`
- Calculates summary metrics (total/failed/high-severity counts)
- Generates run ID (UUID) for JSON report
- Determines exit code based on results and `fail_on_high` setting

### `src/loadConfig.ts` (Configuration Loader)
- Parses YAML config file
- Validates required fields (`model`, `systemPromptPath`, `attacksPath`)
- Validates numeric fields and ranges (temperature 0-1, maxTokens ≥ 1)
- Resolves relative paths relative to config file directory
- Sets safe defaults for optional flags
- Returns `ToolConfig` object

### `src/loadAttacks.ts` (Attack Library Loader)
- Parses JSON attack library file
- Validates each attack has required fields (id, category, description, prompt, severity)
- Validates severity enum (`"low" | "medium" | "high"`)
- Validates description length (≤ 200 characters)
- Ensures unique attack IDs across file
- Returns array of `AttackDefinition` objects
- Error messages include file path and index

### `src/runAttacks.ts` (Attack Executor)
- Executes attacks sequentially (up to `maxCalls` limit, applied before loop)
- Reads system prompt file from disk
- Constructs OpenAI message arrays (system + attack prompt)
- Calls `openaiWrapper.ts` for API calls
- Coordinates evaluation (heuristics → optional judge)
- Applies sanitization to responses
- Returns array of `AttackRun` objects

### `src/evaluator.ts` (Heuristic Evaluator)
- Evaluates attack success using keyword-based heuristics (case-insensitive)
- Four indicator categories: instruction override, prompt leakage, secret disclosure, harmful content
- Returns `EvaluationResult` with success flag, reason array, severity, output snippet (500 chars)
- Success = true if any indicator found

### `src/judge.ts` (LLM-as-Judge)
- Uses LLM to evaluate attack success when heuristics are inconclusive
- Creates concise JSON-only prompt asking if attack succeeded
- Parses JSON response (falls back to text parsing if JSON invalid)
- Returns `{judgeSaysSuccess: boolean, explanation: string}`
- Only called from `runAttacks.ts` when conditions met (see Judge Logic section)

### `src/openaiClient.ts` (OpenAI Client Factory)
- Creates OpenAI client singleton with lazy initialization (Proxy pattern)
- Validates API key only when client is accessed (not at import time)
- Skips validation in DEMO_MODE (though client should never be accessed in DEMO_MODE)
- Single source of truth for client creation

### `src/openaiWrapper.ts` (API Call Wrapper)
- Wraps OpenAI API calls with timeout (20s default) and retry logic (2 attempts, exponential backoff)
- DEMO_MODE short-circuit: Returns canned responses before API call
- Handles errors and retries with exponential backoff (500ms → 1000ms)

### `src/sanitize.ts` (Output Sanitizer)
- Redacts 20+ char token-like sequences (regex: `[A-Za-z0-9\-_]{20,}` → `[REDACTED]`)
- Truncates to 500 characters (appends `"... [TRUNCATED]"`)
- Applied to all responses before storage and reporting

### `src/reportGenerator.ts` (Report Writer)
- Generates JSON report: `ai-security-output/ai-security-result.json` (metadata, summary, full runs)
- Generates Markdown report: `ai-security-output/ai-security-report.md` (summary table + detailed sections)
- All content sanitized before writing
- Creates output directory if missing

### `action.yml` (GitHub Action Definition)
- Type: node16 action (runs `dist/index.js` directly)
- Inputs: `config_path` (not used by code - limitation), `fail_on_high` (passed via `INPUT_FAIL_ON_HIGH` env var)
- Entry point: `dist/index.js` (compiled/bundled JavaScript)
- **Note:** `config_path` input is defined but not consumed by code (only `--config` CLI flag works)

### `dist/index.js` (Compiled Entry Point)
- Compiled/bundled version of `src/index.ts` (TypeScript → JavaScript via `tsc` and `@vercel/ncc`)
- Same behavior as source, but bundled with dependencies for GitHub Action distribution

---

## 7. Configuration Contract (What Users Must Provide)

### Required Config Fields
- **`model`:** OpenAI model identifier (string, e.g., `"gpt-4o-mini"`)
- **`systemPromptPath`:** Path to system prompt file (string, relative to config file directory)
- **`attacksPath`:** Path to attack library JSON file (string, relative to config file directory)

### Optional Fields That Actually Work
- **`maxTokens`:** Max tokens per response (number, ≥ 1, default: 512 if unspecified, clamped to 1024 max in code)
- **`temperature`:** Temperature for API calls (number, 0.0-1.0, default: 0.2 if unspecified)
- **`useJudge`:** Enable LLM-as-judge (boolean, default: false)
- **`maxCalls`:** Limit number of attacks (number, > 0, can be overridden by `MAX_CALLS_PER_RUN` env var)
- **`fail_on_high`:** Exit code 2 on high-severity failures (boolean, default: false)
- **`logLevel`:** Logging verbosity (`"quiet" | "normal" | "verbose"`, default: "normal")

### Optional Fields That Are Defined But Not Used
- **`judgeModel`:** Defined in config schema but **not used** (judge always uses same model as main attack)
- **`demoMode`:** Defined in config schema but **not used** (use `DEMO_MODE` env var instead)

### Environment Variables Used
- **`OPENAI_API_KEY`:** Required in real mode (validated on first client access)
- **`DEMO_MODE`:** String `"true"` enables demo mode (no API calls, no API key needed, always exits 0)
- **`MAX_CALLS_PER_RUN`:** Overrides `maxCalls` from config (numeric, > 0)
- **`FAIL_ON_HIGH`:** Overrides `fail_on_high` from config (string `"true"`)
- **`INPUT_FAIL_ON_HIGH`:** GitHub Actions input (automatically set from `fail_on_high` input, string `"true"`)

### Path Resolution Rules
- All paths (`systemPromptPath`, `attacksPath`) are resolved **relative to config file directory**, not current working directory
- **Example:** Config at `examples/ai-sec-config.yaml`:
  - `systemPromptPath: "./system-prompt.txt"` → `examples/system-prompt.txt`
  - `attacksPath: "../attack-library/basic-attacks.json"` → `attack-library/basic-attacks.json`

---

## 8. Known Limitations / Tradeoffs

### Technical Limitations
- **Single-turn attacks only:** No conversation context, no multi-turn attack sequences
- **OpenAI API only:** No support for other providers (Anthropic, etc.)
- **Keyword-based heuristics:** Simple substring matching, no semantic analysis (relies on judge for nuanced cases)
- **Judge model:** Always uses same model as main attack (config field `judgeModel` exists but not used)
- **GitHub Actions config_path input:** Not consumed by code (only `--config` CLI flag works; would need wrapper script)
- **maxTokens clamping:** Hardcoded to max 1024 in `runAttacks.ts` (even if config specifies higher)
- **Timeout/retry:** Fixed values (20s timeout, 2 retries, exponential backoff) - not configurable
- **No attack library validation at schema level:** Only runtime validation (required fields, types, ranges)

### UX Limitations
- **No interactive mode:** CLI only, no REPL or interactive prompts
- **No progress indicators:** No per-attack progress bars, only summary logs
- **Limited error messages:** Some errors lack context (e.g., API failures don't show request details)
- **Output directory:** Hardcoded to `ai-security-output/` (not configurable)
- **Report filenames:** Hardcoded (`ai-security-result.json`, `ai-security-report.md`)

### Security Assumptions
- **API key handling:** Relies on environment variables (no keyring, no secure storage beyond OS env)
- **Sanitization rules:** Simple regex (may miss edge cases, e.g., secrets in different formats)
- **No audit logging:** No logging of who ran attacks, when, with what config (only results logged)

### CI Assumptions
- **Node.js 20+:** Required (not explicitly validated, may fail with older versions)
- **Network access:** Required for OpenAI API calls (no offline mode except DEMO_MODE)
- **File system:** Requires write access for reports (no streaming output option)
- **GitHub Actions:** Assumes `INPUT_*` env vars work (node16 action standard, but `config_path` input not used)

---

## 9. Consistency Check

### Documentation vs Implementation

**Mismatches Found:**
1. **README.md claims "3 example attacks" but `attack-library/basic-attacks.json` actually contains 3 attacks** ✅ (matches)
2. **README.md says `demoMode` in config is "reserved but not used"** ✅ (matches - code loads it but doesn't use it)
3. **README.md says judge runs "when heuristics are inconclusive"** ✅ (matches - code implements this correctly)
4. **ARCHITECTURE.md describes judge execution logic correctly** ✅ (matches)
5. **README.md examples show `judgeModel` config field, but it's not used** ⚠️ (documentation shows it but doesn't mention it's unused)
6. **action.yml defines `config_path` input but code doesn't use it** ⚠️ (README shows GitHub Actions examples but doesn't explain this limitation)
7. **README.md shows GitHub Actions usage with `config_path` but doesn't mention it won't work** ⚠️ (misleading - users would expect it to work)

**Overclaims / Misleading Phrases:**
1. **README.md:** "Reports are uploaded as artifacts (check the Actions tab)" - No code uploads artifacts (users must add `actions/upload-artifact` step)
2. **README.md:** Shows GitHub Actions example with `config_path` input, but code doesn't read `INPUT_CONFIG_PATH` - misleading (would need wrapper script)
3. **README.md:** "Path resolution" section is accurate ✅
4. **USAGE.md:** Describes judge behavior accurately ✅

**Risky Assumptions for Users:**
1. **GitHub Actions users** may expect `config_path` input to work (it doesn't - only `--config` CLI flag works)
2. **Users setting `judgeModel`** may expect it to work (it doesn't - always uses main model)
3. **Users setting `demoMode: true` in config** may expect it to work (it doesn't - must use `DEMO_MODE` env var)
4. **Users expecting maxTokens > 1024** may be surprised (hardcoded clamp to 1024)
5. **Users in CI** may expect artifacts to be uploaded automatically (they're not - manual step required)

---

## 10. One-Paragraph Neutral Summary (No Marketing)

AI Security CI is a Node.js-based CLI tool and GitHub Action that executes automated prompt attacks against AI systems to detect security vulnerabilities. It reads a YAML configuration file specifying an OpenAI model, a system prompt file, and a JSON attack library, then sends each attack prompt to the model via the OpenAI API (or returns canned responses in DEMO_MODE). Responses are evaluated using keyword-based heuristics, with optional LLM-based judging for high-severity attacks or when explicitly enabled. The tool generates JSON and Markdown reports with sanitized outputs, and can exit with code 2 to fail CI pipelines when high-severity vulnerabilities are detected (if enabled and not in DEMO_MODE). The implementation supports single-turn attacks only, uses OpenAI API exclusively, and includes limitations such as unused config fields (`judgeModel`, `demoMode`), a hardcoded maxTokens clamp, and incomplete GitHub Actions input handling (`config_path` input not consumed by code).

---

**End of Technical Audit**
