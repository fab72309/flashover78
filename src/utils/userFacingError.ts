const SENSITIVE_ERROR_PATTERN = /(?:https?:\/\/|postgres|postgrest|supabase|storage|pgrst|sql|jwt|row[- ]level|constraint|relation|column|schema|permission denied|failed to fetch|network request|stack trace)/i;

/**
 * Keep provider/database details out of rendered toasts while preserving
 * short, deliberate validation messages created by the application itself.
 */
export function getUserFacingError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  const hasControlCharacter = [...message].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f);
  if (
    !message
    || message.length > 240
    || hasControlCharacter
    || /[<>]/.test(message)
    || SENSITIVE_ERROR_PATTERN.test(message)
  ) {
    return fallback;
  }
  return message;
}
