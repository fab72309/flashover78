const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const LEGACY_OFFICE_EXTENSIONS = new Set(['doc', 'ppt']);

export function expectedDocumentMimeType(extension: string) {
  return {
    pdf: 'application/pdf',
    odt: 'application/vnd.oasis.opendocument.text',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
  }[extension] ?? 'application/octet-stream';
}

/**
 * Legacy OLE Office files remain recognizable for historical metadata, but
 * are not accepted for new uploads until a quarantine/antivirus service is
 * available.
 */
export function isUploadableDocumentExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return [
    'pdf',
    'odt',
    'docx',
    'pptx',
    'txt',
  ].includes(normalized) && !LEGACY_OFFICE_EXTENSIONS.has(normalized);
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasText(bytes: Uint8Array, value: string) {
  return new TextDecoder('latin1').decode(bytes).includes(value);
}

/**
 * Lightweight content/type consistency check. This is deliberately not an
 * antivirus or sandbox: it only rejects files whose bytes do not match their
 * declared document family before they reach Storage.
 */
export async function hasExpectedDocumentSignature(file: Blob, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer());

  if (extension === 'txt') {
    return !bytes.includes(0);
  }

  if (extension === 'pdf') {
    return startsWithBytes(bytes, PDF_HEADER);
  }

  if (extension === 'doc' || extension === 'ppt') {
    return startsWithBytes(bytes, OLE_HEADER);
  }

  if (extension === 'odt') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasText(bytes, 'application/vnd.oasis.opendocument.text');
  }

  if (extension === 'docx') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasText(bytes, '[Content_Types].xml')
      && hasText(bytes, 'word/');
  }

  if (extension === 'pptx') {
    return startsWithBytes(bytes, ZIP_HEADER)
      && hasText(bytes, '[Content_Types].xml')
      && hasText(bytes, 'ppt/');
  }

  return false;
}

export async function assertExpectedDocumentSignature(file: Blob, extension: string) {
  if (!await hasExpectedDocumentSignature(file, extension)) {
    throw new Error('Le contenu du fichier ne correspond pas à son extension déclarée.');
  }
}
