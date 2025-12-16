export function sanitizeOutput(text: string): string {
  if (!text) return "";
  // redact long tokens / secrets
  const redacted = text.replace(/([A-Za-z0-9\-_]{20,})/g, "[REDACTED]");
  // limit dangerous content (optional)
  return redacted.slice(0, 2000);
}

