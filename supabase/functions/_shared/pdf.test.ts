import { describe, expect, it } from 'vitest'
import { decodeBase64Document, isLikelyPdf } from './pdf'

describe('PDF attachment verification', () => {
  it('accepts a minimal PDF structure and rejects renamed text', () => {
    const valid = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF')
    const invalid = new TextEncoder().encode('synthetic-not-a-pdf.pdf')

    expect(isLikelyPdf(valid)).toBe(true)
    expect(isLikelyPdf(invalid)).toBe(false)
  })

  it('rejects invalid base64 and truncated PDF data', () => {
    expect(decodeBase64Document('not base64!')).toBeNull()
    expect(isLikelyPdf(new TextEncoder().encode('%PDF-1.7\ntruncated'))).toBe(false)
  })

  it('does not confuse PDF-looking bytes in a content stream with active content', () => {
    const contentStream = new TextEncoder().encode(
      '%PDF-1.7\n1 0 obj\n<</Length 4>>\nstream\n/JS\nendstream\nendobj\n%%EOF',
    )

    expect(isLikelyPdf(contentStream)).toBe(true)
  })
})
