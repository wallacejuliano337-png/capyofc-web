export function validSource(id: unknown): id is string {
  return typeof id === "string" && /^(screen|window):[0-9]+:[0-9]+$/.test(id);
}
export function validAction(
  action: unknown,
): action is "minimize" | "maximize" | "close" {
  return ["minimize", "maximize", "close"].includes(String(action));
}
