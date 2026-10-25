const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-

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
 *
 * Do not search the raw bytes for PDF names such as `/JS`: those bytes can
 * legitimately occur inside compressed streams or page-content streams. The
 * parser-aware sanitizer is responsible for removing active PDF structures.
 */
export function isLikelyPdf(bytes: Uint8Array) {
  if (bytes.length < PDF_HEADER.length + 5) return false
  if (!PDF_HEADER.every((value, index) => bytes[index] === value)) return false

  const tail = bytes.subarray(Math.max(0, bytes.length - 2048))
  if (!new TextDecoder('latin1').decode(tail).includes('%%EOF')) return false

  return true
}
