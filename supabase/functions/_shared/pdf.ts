const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const UNSAFE_PDF_TOKEN_PATTERN = /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|OpenAction|AA|RichMedia|XFA)\b/i

export function decodeBase64Document(value: string) {
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

/**
 * Lightweight format verification, not malware analysis. It rejects content
 * merely labelled as PDF and requires both a PDF header and EOF marker.
 */
export function isLikelyPdf(bytes: Uint8Array) {
  if (bytes.length < PDF_HEADER.length + 5) return false
  if (!PDF_HEADER.every((value, index) => bytes[index] === value)) return false

  const tail = bytes.subarray(Math.max(0, bytes.length - 2048))
  if (!new TextDecoder('latin1').decode(tail).includes('%%EOF')) return false

  // These features can launch scripts, external actions or embedded content
  // when a recipient opens the attachment. This is a defensive filter, not a
  // malware scanner or a PDF parser; suspicious files must still be quarantined
  // or analysed by an appropriate server-side service before production use.
  return !UNSAFE_PDF_TOKEN_PATTERN.test(new TextDecoder('latin1').decode(bytes))
}
