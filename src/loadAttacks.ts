import fs from "fs";
import path from "path";
import { AttackDefinition, Severity } from "./types";

const validSeverities: Severity[] = ["low", "medium", "high"];

export function loadAttacks(attacksPath: string): AttackDefinition[] {
  const fullPath = path.resolve(attacksPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Attack library file not found at path: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Unable to parse attack library JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Attack library must be a JSON array.");
  }

  const attacks: AttackDefinition[] = parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid attack definition at index ${index}`);
    }

    const { id, category, description, prompt, severity } = item as any;

    // Ensure each attack has required fields
    if (!id || !category || !description || !prompt || !severity) {
      throw new Error(`Missing fields in attack definition at index ${index}`);
    }

    const attackId = String(id);
    const attackDescription = String(description);

    // Ensure description is not overly long
    if (attackDescription.length > 300) {
      throw new Error("Description too long: " + attackId);
    }

    // Ensure severity ∈ {"low","medium","high"}
    if (!validSeverities.includes(severity)) {
      throw new Error(
        `Invalid severity "${severity}" in attack definition ${attackId}. Must be one of ${validSeverities.join(", ")}`
      );
    }

    const attack: AttackDefinition = {
      id: attackId,
      category: String(category),
      description: attackDescription,
      prompt: String(prompt),
      severity
    };

    return attack;
  });

  // Ensure IDs are unique
  const ids = new Set();
  for (const a of attacks) {
    if (ids.has(a.id)) throw new Error("Duplicate attack ID: " + a.id);
    ids.add(a.id);
  }

  return attacks;
}

