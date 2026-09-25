/**
 * Emit a fixed diagnostic without forwarding provider, database or user data
 * to the browser console. Callers must pass a static, non-sensitive context.
 */
export function logClientFailure(context: string): void {
  console.error(`[Flashover78] ${context}`);
}
