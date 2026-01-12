# Verification Report: Implementation vs Claims

**Review Date:** 2025-01-27  
**Reviewer:** Senior Engineer (Neutral Review)  
**Scope:** Full codebase verification against claimed features

---

## Step 1: Codebase Review Summary

**Files Reviewed:**
- `src/index.ts` - Entry point
- `src/loadConfig.ts` - Configuration loading
- `src/loadAttacks.ts` - Attack library loading
- `src/runAttacks.ts` - Attack execution
- `src/evaluator.ts` - Heuristic evaluation
- `src/judge.ts` - LLM-as-judge
- `src/openaiClient.ts` - OpenAI client factory
- `src/openaiWrapper.ts` - API wrapper (DEMO_MODE logic)
- `src/sanitize.ts` - Output sanitization
- `src/reportGenerator.ts` - Report generation
- `action.yml` - GitHub Action definition
- Documentation files (README.md, USAGE.md, ARCHITECTURE.md)

---

## Step 2: Claim Verification

### ✅ FULLY TRUE Claims

1. **"CLI + GitHub Action for AI prompt security testing"**
   - ✅ Confirmed: `src/index.ts` is CLI entry point, `action.yml` defines GitHub Action
   - ✅ `dist/index.js` is bundled entry point for GitHub Action

2. **"Runs simulated prompt attacks (single-turn) against a system prompt"**
   - ✅ Confirmed: Each attack is a single user message (no conversation context)
   - ✅ System prompt is prepended as system message in `runAttacks.ts` line 44-47

3. **"Generates JSON + Markdown reports"**
   - ✅ Confirmed: `reportGenerator.ts` creates both formats
   - ✅ Outputs: `ai-security-result.json` and `ai-security-report.md`

4. **"DEMO_MODE requires no API key"**
   - ✅ Confirmed: Lazy client initialization (Proxy pattern) ensures validation never runs
   - ✅ `openaiWrapper.ts` short-circuits before client access

5. **"DEMO_MODE makes no OpenAI API calls"**
   - ✅ Confirmed: `openaiWrapper.ts` line 29-35 returns canned responses
   - ✅ No actual API calls when `DEMO_MODE === "true"`

6. **"DEMO_MODE always exits with code 0"**
   - ✅ Confirmed: `index.ts` line 79 checks `process.env.DEMO_MODE !== "true"` before exit code 2
   - ✅ DEMO_MODE bypasses high-severity failure exit code

7. **"Resolves all config paths relative to the config file"**
   - ✅ Confirmed: `loadConfig.ts` line 52-54 uses `path.dirname(fullConfigPath)` as base
   - ✅ All paths resolved relative to config file directory, not CWD

8. **"Sanitizes outputs before writing reports"**
   - ✅ Confirmed: `reportGenerator.ts` calls `sanitizeOutput()` on all content (lines 45, 46, 49)
   - ✅ `runAttacks.ts` line 104 sanitizes responses before storing
   - ✅ Sanitization: Redacts 20+ char tokens, truncates to 500 chars

9. **"Is packaged as a GitHub Action using a bundled dist/index.js"**
   - ✅ Confirmed: `action.yml` specifies `main: "dist/index.js"` with `using: "node16"`
   - ✅ `dist/` contains bundled JavaScript (via `tsc` and `@vercel/ncc` per package.json)

10. **"Is intentionally Phase-1 (no SaaS, no dashboard, no multi-turn attacks)"**
    - ✅ Confirmed: README.md explicitly documents Phase-1 boundaries
    - ✅ Codebase contains no SaaS/dashboard/multi-turn implementations

---

### ⚠️ PARTIALLY TRUE Claims

1. **"Uses heuristic evaluation first, then optional LLM-as-judge"**
   - ⚠️ **PARTIALLY TRUE** - Missing critical detail:
   - ✅ Heuristics run first (confirmed in `runAttacks.ts` line 61)
   - ✅ Judge runs conditionally (confirmed in `runAttacks.ts` line 83)
   - ⚠️ **CRITICAL CAVEAT:** Judge runs ONLY if:
     - Heuristics did NOT detect success (`evaluation.success === false`)
     - AND (attack severity === "high" OR `useJudge === true`)
   - ⚠️ **IMPORTANT:** Judge never runs if heuristics already detected success
   - ⚠️ This is more restrictive than "optional" suggests - it's conditional on heuristics failing first

2. **"Can fail CI on high-severity issues when fail_on_high is enabled"**
   - ⚠️ **PARTIALLY TRUE** - Missing critical detail:
   - ✅ Exit code 2 when high-severity failure detected (confirmed in `index.ts` line 80-84)
   - ✅ Respects `fail_on_high` setting from config or env vars
   - ⚠️ **CRITICAL CAVEAT:** Only works when `DEMO_MODE !== "true"`
   - ⚠️ DEMO_MODE always exits 0, even with high-severity failures (by design, line 79)

---

### ❌ NOT TRUE / FRAGILE Claims

**None of the core claims are completely false**, but there are implementation gaps that affect functionality:

---

## Step 3: Honest Assessment

### Which Are Fully True

All 8 items listed as "FULLY TRUE" above are accurate and match the implementation exactly.

### Which Are Partially True

1. **Heuristic → Judge evaluation:**
   - Claim implies judge is optional but runs after heuristics
   - **Reality:** Judge runs ONLY when heuristics fail AND conditions are met
   - This is more restrictive than implied - judge is not just "optional", it's conditional

2. **CI failure on high-severity:**
   - Claim doesn't mention DEMO_MODE bypass
   - **Reality:** `fail_on_high` is completely bypassed in DEMO_MODE (always exits 0)
   - This is intentional but should be explicitly stated in the claim

### Which Are Not True

**None** - All core claims are true or partially true. However, there are **critical functionality gaps** that make some claims misleading in practice.

### Important Behavior Missing from Claims

1. **GitHub Actions `config_path` input doesn't work:**
   - `action.yml` defines `config_path` input (line 5-8)
   - Code only reads `--config` CLI flag (`index.ts` line 10-19)
   - Code does NOT read `INPUT_CONFIG_PATH` environment variable
   - **Impact:** GitHub Action always uses default `examples/ai-sec-config.yaml` regardless of input
   - **Workaround:** Users can't specify custom config path via GitHub Actions (only via CLI)

2. **Unused config fields:**
   - `judgeModel` exists in config schema (`types.ts`, `loadConfig.ts`) but is never used
   - Judge always uses same model as main attack (`runAttacks.ts` line 87)
   - `demoMode` exists in config schema but is never used (must use `DEMO_MODE` env var)

3. **Hardcoded limits:**
   - `maxTokens` is clamped to maximum 1024 in code (`runAttacks.ts` line 52: `Math.min(maxTokens ?? 512, 1024)`)
   - Config can specify higher value but it's silently clamped

4. **Judge execution details:**
   - Judge can override heuristic `false → true` but never `true → false`
   - Judge failures are silently caught and ignored (falls back to heuristic result)
   - Judge uses fixed token limit (150) and temperature (0.0), not configurable

### Documentation Claims That Don't Match Implementation

1. **README.md line 133:** "Reports are uploaded as artifacts (check the Actions tab)"
   - ❌ **FALSE:** Code does not upload artifacts
   - ✅ Users must add `actions/upload-artifact` step manually (as shown in `.github/workflows/ai-security-scan.yml`)
   - **Impact:** Misleading - users expect automatic artifact upload

2. **README.md GitHub Actions examples:** Show `config_path` input being used
   - ⚠️ **MISLEADING:** Input is defined but not consumed by code
   - GitHub Actions will always use default path regardless of input value
   - **Impact:** Users will be confused when their config_path input is ignored

3. **README.md / USAGE.md:** Show `judgeModel` in config examples (implicitly)
   - ⚠️ **MISLEADING:** Field exists in schema but is never used
   - **Impact:** Users may set this expecting it to work

4. **README.md / ARCHITECTURE.md:** Judge logic description is accurate
   - ✅ Documentation correctly explains judge only runs when heuristics fail AND conditions met

---

## Step 4: Final Verdict

### What This Tool Actually Is Today

AI Security CI is a Node.js-based CLI tool and GitHub Action that executes single-turn prompt attacks against AI systems to detect security vulnerabilities. It reads a YAML configuration file, loads a JSON attack library, sends each attack to an OpenAI model (or returns canned responses in DEMO_MODE), evaluates responses using keyword-based heuristics, optionally uses LLM-as-judge when heuristics are inconclusive and conditions are met, sanitizes all outputs, and generates JSON and Markdown reports. The tool can fail CI pipelines with exit code 2 when high-severity vulnerabilities are detected (if enabled and not in DEMO_MODE). The implementation has several gaps: the GitHub Actions `config_path` input is not consumed by code (always uses default), unused config fields (`judgeModel`, `demoMode`) exist in the schema, and `maxTokens` is silently clamped to 1024.

### What Must Be Fixed Before Calling Phase-1 "Done"

1. **GitHub Actions `config_path` input must work:**
   - Code must read `INPUT_CONFIG_PATH` environment variable (GitHub Actions converts inputs to `INPUT_*` env vars)
   - OR: Remove `config_path` input from `action.yml` and document that it doesn't work
   - **Current state:** Input is defined but ignored, causing user confusion

2. **Documentation accuracy:**
   - Remove or correct claim about automatic artifact upload (README.md line 133)
   - Document that `config_path` input doesn't work (if not fixing it)
   - Document that `judgeModel` and `demoMode` config fields are unused (or remove them)

3. **Clarity on DEMO_MODE behavior:**
   - Explicitly state in claims that `fail_on_high` is bypassed in DEMO_MODE (always exits 0)
   - This is intentional but should be explicitly documented

### What Should Explicitly Wait for Phase-2

1. **Multi-turn attacks** - Current implementation is single-turn only (intentionally Phase-1)
2. **Dashboard/SaaS** - Reports are file-based only (intentionally Phase-1)
3. **Non-OpenAI providers** - OpenAI API only (intentionally Phase-1)
4. **Judge model configuration** - Use same model as main attack (can be Phase-2 enhancement)
5. **Configurable judge parameters** - Currently hardcoded (150 tokens, 0.0 temp) (can be Phase-2 enhancement)
6. **Removing unused config fields** - Can be cleanup item for Phase-2 or done in Phase-1

---

**Review Conclusion:** The core claims are accurate, but there are **3 critical gaps** that affect functionality (GitHub Actions config_path input, artifact upload claim, unused config fields). The tool is functionally complete for Phase-1 scope, but these gaps cause user confusion and should be fixed before declaring Phase-1 complete.
