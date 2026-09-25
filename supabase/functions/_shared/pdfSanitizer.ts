import { PDFDocument, PDFName } from 'npm:pdf-lib@1.17.1'
import { isLikelyPdf } from './pdf.ts'

const DEFAULT_MAX_PDF_BYTES = 5 * 1024 * 1024

// Remove catalog actions, embedded files and page annotations before a PDF is
// stored or sent to Brevo. This is canonicalization, not antivirus scanning.
const UNSAFE_CATALOG_KEYS = [
  'AA',
  'AcroForm',
  'Collection',
  'EmbeddedFiles',
  'JavaScript',
  'JS',
  'Launch',
  'Names',
  'OpenAction',
  'Perms',
  'RichMedia',
  'SubmitForm',
  'XFA',
]

export async function sanitizePdf(bytes: Uint8Array, maxBytes = DEFAULT_MAX_PDF_BYTES) {
  if (
    !Number.isInteger(maxBytes)
    || maxBytes < 1
    || bytes.byteLength < 1
    || bytes.byteLength > maxBytes
    || !isLikelyPdf(bytes)
  ) {
    return null
  }

  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    })
    const catalog = document.context.lookup(document.context.trailerInfo.Root)
    if (!catalog || typeof catalog.delete !== 'function') return null

    UNSAFE_CATALOG_KEYS.forEach((key) => catalog.delete(PDFName.of(key)))
    document.getPages().forEach((page) => {
      page.node.delete(PDFName.of('AA'))
      // Removing annotations also removes URI, GoToR, Launch and form actions
      // that may be represented indirectly or compressed in the source PDF.
      page.node.delete(PDFName.of('Annots'))
    })

    const sanitized = await document.save({
      addDefaultPage: false,
      updateFieldAppearances: false,
      useObjectStreams: false,
    })
    if (sanitized.byteLength < 1 || sanitized.byteLength > maxBytes) return null

    const result = new Uint8Array(sanitized)
    return isLikelyPdf(result) ? result : null
  } catch {
    return null
  }
}
