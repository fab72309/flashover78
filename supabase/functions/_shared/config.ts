/**
 * Resolve a server-side Supabase key without guessing between projects.
 *
 * Legacy single-value variables remain supported for existing deployments.
 * When the named JSON form is used, only an explicit `default` value is
 * accepted. Picking the first object value would make a malformed
 * multi-project configuration silently select an arbitrary project key.
 */
export function selectConfiguredKey(legacyValue: unknown, namedValue: unknown) {
  if (typeof legacyValue === 'string' && legacyValue.trim()) {
    return legacyValue.trim()
  }

  if (typeof namedValue !== 'string' || !namedValue.trim()) return ''

  try {
    const parsed: unknown = JSON.parse(namedValue)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''
    const defaultValue = (parsed as Record<string, unknown>).default
    return typeof defaultValue === 'string' ? defaultValue.trim() : ''
  } catch {
    return ''
  }
}

export function getConfiguredKey(legacyName: string, namedKeysName: string) {
  return selectConfiguredKey(Deno.env.get(legacyName), Deno.env.get(namedKeysName))
}
