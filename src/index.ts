#!/usr/bin/env node
import path from "path";
import { randomUUID } from "crypto";
import { loadConfig } from "./loadConfig";
import { loadAttacks } from "./loadAttacks";
import { runAttacks } from "./runAttacks";
import { writeJsonResult, writeMarkdownReport } from "./reportGenerator";
import { log } from "./logger";

function getConfigPathFromArgs(): string {
  const args = process.argv.slice(2);
  const configFlagIndex = args.indexOf("--config");

  if (configFlagIndex !== -1 && args[configFlagIndex + 1]) {
    return args[configFlagIndex + 1];
  }

  return "examples/ai-sec-config.yaml";
}

async function main() {
  try {
    const configPath = getConfigPathFromArgs();
    log("normal", "normal", `🔧 Loading config from: ${path.resolve(configPath)}`);
    const config = loadConfig(configPath);

    log("normal", config.logLevel || "normal", "✅ Config loaded.");
    const attacks = loadAttacks(config.attacksPath);
    log("normal", config.logLevel || "normal", `📦 Loaded ${attacks.length} attacks.`);

    log("normal", config.logLevel || "normal", "⚔️  Running attacks (this will call the OpenAI API) ...");
    const maxCallsEnv = process.env.MAX_CALLS_PER_RUN ? Number(process.env.MAX_CALLS_PER_RUN) : undefined;
    const runs = await runAttacks(
      attacks,
      config.systemPromptPath,
      config.model,
      config.maxTokens,
      config.temperature,
      !!config.useJudge,
      config.maxCalls ?? maxCallsEnv,
      config.logLevel
    );

    log("normal", config.logLevel || "normal", "🧾 Writing results...");
    const outDir = "ai-security-output";
    const runId = randomUUID();
    writeJsonResult(outDir, runs, runId, attacks.length);
    writeMarkdownReport(outDir, runs);

    const failed = runs.filter(r => r.evaluation.success).length;
    log("normal", config.logLevel || "normal", `✅ Done. ${failed}/${runs.length} attacks succeeded (bad).`);
    log("normal", config.logLevel || "normal", `Results: ${path.resolve(outDir)}/ai-security-result.json`);
    log("normal", config.logLevel || "normal", `Report: ${path.resolve(outDir)}/ai-security-report.md`);

    // Fail on high severity only if enabled and not in DEMO mode
    if (process.env.DEMO_MODE !== "true" && config.fail_on_high) {
      const highFail = runs.some(r => r.attack.severity === "high" && r.evaluation.success === true);
      if (highFail) {
        console.error("❌ High severity failure detected — exiting with code 2.");
        process.exit(2);
      }
    }

    // Default successful exit
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", (err as Error).message);
    process.exit(1);
  }
}

main();

