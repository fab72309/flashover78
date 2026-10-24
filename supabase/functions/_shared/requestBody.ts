export type JsonBodyResult =
  | { data: Record<string, unknown>; error: null }
  | { data: null; error: 'too_large' | 'invalid' }

// Enforce the real byte limit while reading, independently of Content-Length.
export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const reader = request.body?.getReader()
  if (!reader) return { data: null, error: 'invalid' }
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { data: null, error: 'too_large' }
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { data: null, error: 'invalid' }
    }
    return { data: value as Record<string, unknown>, error: null }
  } catch {
    await reader.cancel().catch(() => undefined)
    return { data: null, error: 'invalid' }
  } finally {
    reader.releaseLock()
  }
}
