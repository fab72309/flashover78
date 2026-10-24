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

  it('rejects PDFs containing active-content markers', () => {
    const unsafe = new TextEncoder().encode(
      '%PDF-1.7\n1 0 obj\n<</OpenAction 2 0 R>>\nendobj\n%%EOF',
    )

    expect(isLikelyPdf(unsafe)).toBe(false)
  })
})
