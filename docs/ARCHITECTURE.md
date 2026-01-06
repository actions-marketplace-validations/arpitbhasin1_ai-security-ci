# Architecture & Implementation Details

This document describes the internal architecture, execution flow, and component responsibilities of AI Security CI.

## Execution Flow

### Step 1: Entry Point

**CLI:**
```bash
npm run ai-sec -- --config examples/ai-sec-config.yaml
```

**GitHub Action:**
```yaml
uses: your-org/ai-security-ci@v1
with:
  config_path: "examples/ai-sec-config.yaml"
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Step 2: Config Loading (`loadConfig.ts`)

- Reads YAML config file (default: `examples/ai-sec-config.yaml`)
- Validates required fields: `model`, `systemPromptPath`, `attacksPath`
- Validates numeric fields (`maxTokens`, `temperature`, `maxCalls`) and ranges
- **Path resolution**: All relative paths resolved relative to config file directory
- Sets safe defaults for optional flags (`useJudge: false`, `fail_on_high: false`, `logLevel: "normal"`)

### Step 3: System Prompt Loading

- Reads system prompt file from resolved `systemPromptPath`
- File is read as plain text (no special formatting required)
- Content is used as the `system` message in all OpenAI API calls

### Step 4: Attack Library Loading (`loadAttacks.ts`)

- Reads JSON attack library from resolved `attacksPath`
- Validates each attack has: `id`, `category`, `description`, `prompt`, `severity`
- Validates `severity` ∈ `{"low", "medium", "high"}`
- Validates description length ≤ 200 characters
- Ensures attack IDs are unique across the file
- Returns array of `AttackDefinition` objects

### Step 5: Attack Execution (`runAttacks.ts`)

For each attack (up to `maxCalls` limit):

1. **Message Construction**: Creates OpenAI message array with system prompt and attack prompt
2. **API Call** (`openaiWrapper.ts`):
   - **DEMO_MODE=true**: Returns canned responses (no API call)
   - **DEMO_MODE=false**: Calls OpenAI API with timeout (20s) and retry (2 attempts, exponential backoff)
3. **Response Extraction**: Extracts `content` from first choice's message
4. **Heuristic Evaluation** (`evaluator.ts`): Scans response for indicator keywords
5. **Optional Judge Call** (`judge.ts`): Runs only if heuristics didn't detect success AND (severity === 'high' OR useJudge === true)
6. **Sanitization** (`sanitize.ts`): Redacts tokens and truncates to 500 chars
7. **Result Storage**: Creates `AttackRun` object

### Step 6: Report Generation (`reportGenerator.ts`)

- **JSON Report**: Metadata, summary, full runs array
- **Markdown Report**: Summary table + detailed sections (all content sanitized)

### Step 7: Exit Code Logic (`index.ts`)

- **Exit 0**: Normal completion (or DEMO_MODE always exits 0)
- **Exit 1**: Error during execution
- **Exit 2**: High-severity failure detected AND `fail_on_high === true` AND `DEMO_MODE !== "true"`

## Component Responsibilities

### `src/index.ts` (Entry Point)
- CLI entry point, orchestrates entire flow
- Config loading → Attack loading → Execution → Reporting → Exit code determination
- Environment handling: Reads `MAX_CALLS_PER_RUN`, `FAIL_ON_HIGH`, `DEMO_MODE`
- Output: Console logs, JSON/Markdown reports, exit codes

### `src/loadConfig.ts` (Configuration Loader)
- Parse YAML config, validate fields, resolve paths
- Path resolution: All relative paths resolved relative to config file directory
- Validation: Required fields, numeric types, ranges (temperature 0-1, maxTokens ≥ 1)
- Defaults: Safe defaults for optional flags

### `src/loadAttacks.ts` (Attack Library Loader)
- Parse JSON attack library, validate structure
- Validation: Required fields, severity enum, description length (≤200), unique IDs
- Error messages: Include file path and index for debugging

### `src/runAttacks.ts` (Attack Executor)
- Execute attacks sequentially, coordinate evaluation and judging
- Judge logic: Only runs when heuristics are inconclusive AND (high severity OR useJudge flag)
- maxCalls enforcement: Limits attacks before loop execution

### `src/openaiClient.ts` (OpenAI Client Factory)
- Single source of truth for OpenAI client creation and API key validation
- Lazy initialization: Uses Proxy pattern to defer client creation until first property access
- DEMO_MODE support: Skips API key validation when `DEMO_MODE === "true"`
- Critical: No validation at import time - only when client is actually used

### `src/openaiWrapper.ts` (API Call Wrapper)
- Wrap OpenAI calls with timeout, retry, and DEMO_MODE handling
- DEMO_MODE: Short-circuits before API call, returns canned responses
- Retry logic: 2 retries with exponential backoff (500ms → 1000ms)
- Timeout: 20 seconds default

### `src/evaluator.ts` (Heuristic Evaluator)
- Evaluate attack success using keyword-based heuristics
- Indicators: Four categories (instruction override, prompt leakage, secret disclosure, harmful content)
- Logic: Case-insensitive substring matching, returns success if any indicator found
- Output: `EvaluationResult` with success flag and reason array

### `src/judge.ts` (LLM-as-Judge)
- Use LLM to evaluate attack success when heuristics are inconclusive
- Prompt: Concise JSON-only prompt asking if attack succeeded
- Parsing: Extracts JSON, falls back to text parsing if JSON invalid
- Usage: Only called when heuristics didn't detect success AND (high severity OR useJudge flag)

### `src/sanitize.ts` (Output Sanitizer)
- Redact sensitive data from outputs before storage/reporting
- Rules: Redact 20+ char token-like sequences, truncate to 500 chars
- Applied: To all responses before storing in `AttackRun`, and to all report content

### `src/reportGenerator.ts` (Report Writer)
- Generate JSON and Markdown reports from attack results
- JSON: Structured data with metadata, summary, full runs array
- Markdown: Human-readable table + detailed sections
- Sanitization: All content sanitized before writing

### `src/logger.ts` (Logging Utility)
- Control output based on log level (`quiet`, `normal`, `verbose`)
- Used throughout codebase for consistent logging

### `action.yml` (GitHub Action Definition)
- Type: Node16 action (not composite)
- Entry point: `dist/index.js` (bundled JavaScript)
- Inputs: `config_path`, `fail_on_high`
- Environment: `OPENAI_API_KEY` from secrets, `MAX_CALLS_PER_RUN`, `FAIL_ON_HIGH` from env

## DEMO_MODE Behavior

**DEMO_MODE=true** enables zero-API-cost testing:

1. **API Key Validation**: Skipped entirely (no `OPENAI_API_KEY` required)
2. **API Calls**: Short-circuited in `openaiWrapper.ts`, returns canned responses
3. **Exit Codes**: Always exits 0 (never fails CI, even with high-severity findings)
4. **Use Cases**: Testing, CI/CD workflows, GitHub Marketplace compliance

**Why No API Key Required:**
- Lazy client initialization: `openaiClient.ts` uses Proxy pattern - validation only happens when client is accessed
- Early short-circuit: `openaiWrapper.ts` checks `DEMO_MODE` before using client
- Result: Client is never accessed in DEMO_MODE, so validation never runs

## Judge Execution Logic

The judge runs **ONLY IF**:
1. Heuristics did NOT detect success (`evaluation.success === false`)
2. AND (`attack.severity === "high"` OR `config.useJudge === true`)

**Judge behavior:**
- If judge says success but heuristics didn't, overrides `evaluation.success = true`
- Judge never overrides a heuristic success (never changes `true` → `false`)

## Configuration Contract

### Required Fields
- `model`: OpenAI model identifier
- `systemPromptPath`: Path to system prompt file (relative to config dir)
- `attacksPath`: Path to attack library JSON (relative to config dir)

### Optional Fields
- `maxTokens`: Max tokens per response
- `temperature`: 0.0-1.0
- `useJudge`: Enable LLM-as-judge
- `maxCalls`: Limit number of attacks
- `fail_on_high`: Exit code 2 on high-severity failures
- `judgeModel`: Model for judge calls (default: same as main model)
- `demoMode`: Reserved but not used (use `DEMO_MODE` env var instead)
- `logLevel`: `"quiet" | "normal" | "verbose"`

### Path Resolution
All paths are resolved relative to the config file directory.

