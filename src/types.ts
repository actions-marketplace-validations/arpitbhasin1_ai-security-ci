export interface ToolConfig {
  model: string;
  systemPromptPath: string;
  attacksPath: string;
  maxTokens?: number;
  temperature?: number;
  useJudge?: boolean;
  maxCalls?: number;
  fail_on_high?: boolean;
  logLevel?: "quiet" | "normal" | "verbose";
}

export type Severity = "low" | "medium" | "high";

export interface AttackDefinition {
  id: string;
  category: string;
  description: string;
  prompt: string;
  severity: Severity;
}
