import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'npm:pdf-lib@1.17.1'
import { isLikelyPdf } from './pdf.ts'

const DEFAULT_MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_PDF_OBJECTS_TO_SANITIZE = 100_000

// Remove active actions, embedded files, forms and annotations before a PDF is
// stored or sent to Brevo. This is canonicalization, not antivirus scanning.
const UNSAFE_PDF_KEYS = new Set([
  'A',
  'AA',
  'AcroForm',
  'Annots',
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
])

/**
 * Remove dangerous PDF dictionary entries by inspecting parsed PDF objects.
 * Raw-byte token scans are deliberately avoided because names can appear in
 * compressed image data or ordinary page-content streams.
 */
function removeUnsafePdfEntries(document: PDFDocument) {
  const context = document.context
  const visitedObjects = new Set<PDFArray | PDFDict>()
  const visitedRefs = new Set<string>()
  let visitedCount = 0

  const visit = (value: unknown): void => {
    if (value instanceof PDFRef) {
      if (visitedRefs.has(value.tag)) return
      visitedRefs.add(value.tag)
      visit(context.lookup(value))
      return
    }

    if (value instanceof PDFDict) {
      if (visitedObjects.has(value)) return
      visitedObjects.add(value)
      visitedCount += 1
      if (visitedCount > MAX_PDF_OBJECTS_TO_SANITIZE) {
        throw new Error('PDF contains too many objects to sanitize')
      }

      for (const [key, child] of value.entries()) {
        if (UNSAFE_PDF_KEYS.has(key.decodeText())) {
          value.delete(key)
          continue
        }
        visit(child)
      }
      return
    }

    if (value instanceof PDFArray) {
      if (visitedObjects.has(value)) return
      visitedObjects.add(value)
      visitedCount += 1
      if (visitedCount > MAX_PDF_OBJECTS_TO_SANITIZE) {
        throw new Error('PDF contains too many objects to sanitize')
      }

      for (const child of value.asArray()) visit(child)
    }
  }

  // Walk every indirect object so unreachable action dictionaries cannot be
  // retained in the canonicalized file merely because they were not connected
  // to the catalog or a page at the time of inspection.
  for (const [, object] of context.enumerateIndirectObjects()) visit(object)
  visit(context.trailerInfo.Root)
}

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
    if (!(catalog instanceof PDFDict)) return null

    removeUnsafePdfEntries(document)
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
