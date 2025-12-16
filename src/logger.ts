export function log(level: "quiet" | "normal" | "verbose", current: string, msg: string) {
  if (current === "quiet") return;
  if (current === "normal" && level === "verbose") return;
  console.log(msg);
}

