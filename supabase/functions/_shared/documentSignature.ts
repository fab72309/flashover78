import { unzipSync } from 'npm:fflate@0.8.3'

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04]
const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

const DOCUMENT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  odt: 'application/vnd.oasis.opendocument.text',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
}

// Legacy OLE containers can carry macros and active content that cannot be
// assessed safely by this lightweight structural checker.  Keep their MIME
// mapping for historical metadata, but do not accept new uploads until a
// quarantine/antivirus service is deployed.
const LEGACY_OFFICE_EXTENSIONS = new Set(['doc', 'ppt'])

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function containsUnsafeOfficeContent(bytes: Uint8Array) {
  const text = new TextDecoder('latin1').decode(bytes)
  return /(?:vbaProject\.bin|oleObject|externalLinks|activeX|embeddings|TargetMode\s*=\s*["']External["'])/i.test(text)
}

const MAX_ARCHIVE_ENTRIES = 256
const MAX_ARCHIVE_ENTRY_BYTES = 8 * 1024 * 1024
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 32 * 1024 * 1024

function hasUnsafeArchiveEntry(name: string) {
  return name.length === 0
    || name.length > 512
    || name.includes('\\')
    || name.startsWith('/')
    || name.split('/').some((part) => part === '..')
    || /(?:^|\/)(?:vbaProject\.bin|activeX|embeddings|externalLinks|oleObject|customUI)(?:\/|$)/i.test(name)
    || /(?:^|\/)(?:basic|scripts)(?:\/|$)/i.test(name)
}

function hasUnsafeRelationshipContent(bytes: Uint8Array) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return /(?:TargetMode\s*=\s*["']External["']|vbaProject|oleObject|activeX|externalLinks|embeddings)/i.test(text)
}

/**
 * Inspect OOXML/ODF ZIP packages before they are made available from Storage.
 * This is a bounded structural/active-content check, not an antivirus scan.
 * The finalizer rejects malformed packages, path traversal, ZIP bombs and
 * package parts that can load macros, embedded objects or external targets.
 */
function hasSafeOfficePackage(bytes: Uint8Array, extension: string) {
  let totalUncompressed = 0
  let entryCount = 0
  let rejectedByLimit = false
  let rejectedEntry = false
  let archive: Record<string, Uint8Array>

  try {
    archive = unzipSync(bytes, {
      filter(file) {
        entryCount += 1
        totalUncompressed += file.originalSize
        if (
          entryCount > MAX_ARCHIVE_ENTRIES
          || file.originalSize > MAX_ARCHIVE_ENTRY_BYTES
          || totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES
        ) {
          rejectedByLimit = true
          return false
        }

        if (hasUnsafeArchiveEntry(file.name)) {
          rejectedEntry = true
          return false
        }

        return true
      },
    })
  } catch {
    return false
  }

  if (rejectedByLimit || rejectedEntry) return false

  const names = Object.keys(archive)
  if (!names.includes('[Content_Types].xml') && extension !== 'odt') return false

  if (extension === 'odt') {
    const mimetype = archive.mimetype
    if (!mimetype) return false
    const value = new TextDecoder('utf-8', { fatal: false }).decode(mimetype).trim()
    if (value !== 'application/vnd.oasis.opendocument.text') return false
  }

  if (extension === 'docx' && !names.some((name) => /^word\/document\.xml$/i.test(name))) return false
  if (extension === 'pptx' && !names.some((name) => /^ppt\/presentation\.xml$/i.test(name))) return false
  if (extension === 'odt' && !names.some((name) => /^content\.xml$/i.test(name))) return false

  return names
    .filter((name) => /\.rels$/i.test(name))
    .every((name) => !hasUnsafeRelationshipContent(archive[name]))
}

export function expectedDocumentMimeType(extension: string) {
  return DOCUMENT_MIME_TYPES[extension.toLowerCase()] ?? null
}

export function isUploadableDocumentExtension(extension: string) {
  const normalized = extension.trim().toLowerCase()
  return Boolean(DOCUMENT_MIME_TYPES[normalized]) && !LEGACY_OFFICE_EXTENSIONS.has(normalized)
}

/**
 * Server-side type consistency check. It is intentionally not antivirus: the
 * finalizer only accepts bytes matching the declared family and rejects
 * obvious active Office payloads before the object can be referenced.
 */
export function hasExpectedDocumentSignature(bytes: Uint8Array, extension: string) {
  const normalizedExtension = extension.toLowerCase()
  if (bytes.byteLength < 1 || containsUnsafeOfficeContent(bytes)) return false

  if (normalizedExtension === 'txt') {
    return !bytes.includes(0)
  }

  if (normalizedExtension === 'pdf') {
    return startsWithBytes(bytes, PDF_HEADER)
  }

  if (normalizedExtension === 'doc' || normalizedExtension === 'ppt') {
    return startsWithBytes(bytes, OLE_HEADER)
  }

  if (normalizedExtension === 'odt') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasSafeOfficePackage(bytes, normalizedExtension)
  }

  if (normalizedExtension === 'docx') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasSafeOfficePackage(bytes, normalizedExtension)
  }

  if (normalizedExtension === 'pptx') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasSafeOfficePackage(bytes, normalizedExtension)
  }

  return false
}
