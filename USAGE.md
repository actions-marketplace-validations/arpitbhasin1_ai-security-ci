# USAGE — AI Security CI (Phase 1 MVP)

**Purpose:** Defensive testing of your own AI prompts and agents in CI. This tool runs simulated prompt attacks (jailbreaks, leak attempts, harmful requests) against your model and reports issues.

## Quick start (local)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your OpenAI API key** (or use DEMO_MODE for zero-API-cost testing):
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

3. **Run the security tests:**
   ```bash
   npm run ai-sec -- --config examples/ai-sec-config.yaml
   ```

4. **View results:**
   - JSON report: `ai-security-output/ai-security-result.json`
   - Markdown report: `ai-security-output/ai-security-report.md`

## DEMO_MODE (Zero-API-Cost Testing)

Test the tool without making real API calls:

```bash
export DEMO_MODE="true"
npm run ai-sec -- --config examples/ai-sec-config.yaml
```

**Note:** DEMO_MODE uses canned responses. When DEMO_MODE is off, you will be charged for OpenAI API usage based on your model and token consumption.

## Configuration Options

### maxCalls

Limit the number of attacks to run (useful for testing or cost control):

**Via config file:**
```yaml
maxCalls: 2
```

**Via environment variable:**
```bash
export MAX_CALLS_PER_RUN=2
npm run ai-sec -- --config examples/ai-sec-config.yaml
```

### fail_on_high

Control whether the tool exits with code 2 when high-severity failures are detected:

**Via config file:**
```yaml
fail_on_high: true  # Default: false
```

**Via environment variable:**
```bash
export FAIL_ON_HIGH="true"
```

**Note:** `fail_on_high` is bypassed in DEMO_MODE. DEMO_MODE always exits with code 0 (never fails CI), even when high-severity failures are detected.
```

### useJudge

Enable LLM-as-judge evaluation. The judge runs ONLY when:
- Heuristics did NOT detect success (`evaluation.success === false`)
- AND (attack severity is 'high' OR `useJudge === true`)

**Judge behavior:**
- Judge can override heuristic result from false → true (if judge detects success that heuristics missed)
- Judge never overrides a heuristic success (never changes true → false)
- Judge failures fall back to heuristic result (errors are logged but do not stop execution)

```yaml
useJudge: true  # Default: false
```

**Note:** If heuristics already detect success, the judge is never called (no API cost). Judge is only used when heuristics are inconclusive.

### logLevel

Control logging verbosity:

```yaml
logLevel: "normal"  # Options: "quiet", "normal", "verbose"
```

## Configuration File Example

Create `examples/ai-sec-config.yaml`:

```yaml
model: "gpt-4o-mini"
systemPromptPath: "./system-prompt.txt"
attacksPath: "../attack-library/basic-attacks.json"
maxTokens: 512
temperature: 0.2
useJudge: true
maxCalls: 3
fail_on_high: false
logLevel: "normal"
```

### Path Resolution

- All paths are resolved **relative to the config file directory**
- Example: If config is at `examples/ai-sec-config.yaml`:
  - `systemPromptPath: "./system-prompt.txt"` → `examples/system-prompt.txt`
  - `attacksPath: "../attack-library/basic-attacks.json"` → `attack-library/basic-attacks.json`

## GitHub Actions Usage

### Basic Setup

Create `.github/workflows/ai-security.yml`:

```yaml
name: AI Security Check
on: [pull_request]

jobs:
  ai_security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run AI Security
        uses: your-org/ai-security-ci@v1
        with:
          config_path: "examples/ai-sec-config.yaml"
          fail_on_high: "true"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### With maxCalls Limit

```yaml
      - name: Run AI Security
        uses: your-org/ai-security-ci@v1
        with:
          config_path: "examples/ai-sec-config.yaml"
          fail_on_high: "true"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MAX_CALLS_PER_RUN: "2"
```

## Attack Library

Phase-1 includes **3 sanitized example attacks** covering:
- Jailbreak attempts
- System prompt leakage
- Harmful content generation

Attack library validation:
- Validates required fields (id, category, description, prompt, severity)
- Validates severity levels (low, medium, high)
- Ensures unique attack IDs
- Validates description length (≤200 characters)

## What This Tool Does NOT Do (Phase-1)

- ❌ No dashboard (JSON/Markdown reports only)
- ❌ No SaaS backend (fully local/CI execution)
- ❌ No multi-turn attacks (single message per attack)
- ❌ No inference-time guards (tests prompts only)
- ❌ No billing/payment (users pay for their own OpenAI API usage)
- ❌ No enterprise features

See [README.md](../README.md) for more details.