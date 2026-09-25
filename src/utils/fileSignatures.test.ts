import { describe, expect, it } from 'vitest';
import {
  expectedDocumentMimeType,
  hasExpectedDocumentSignature,
  isUploadableDocumentExtension,
} from './fileSignatures';

function bytes(value: string) {
  return new Blob([value]);
}

describe('signature légère des fichiers documentaires', () => {
  it('accepts matching PDF and rejects renamed text', async () => {
    expect(await hasExpectedDocumentSignature(bytes('%PDF-1.7\n'), 'pdf')).toBe(true);
    expect(await hasExpectedDocumentSignature(bytes('not a pdf'), 'pdf')).toBe(false);
  });

  it('recognises legacy Office and OOXML families', async () => {
    const ole = new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])]);
    const docx = bytes('PK\u0003\u0004 [Content_Types].xml word/document.xml');
    const pptx = bytes('PK\u0003\u0004 [Content_Types].xml ppt/presentation.xml');
    const odt = bytes('PK\u0003\u0004 mimetypeapplication/vnd.oasis.opendocument.text');
    expect(await hasExpectedDocumentSignature(ole, 'doc')).toBe(true);
    expect(await hasExpectedDocumentSignature(docx, 'docx')).toBe(true);
    expect(await hasExpectedDocumentSignature(pptx, 'pptx')).toBe(true);
    expect(await hasExpectedDocumentSignature(odt, 'odt')).toBe(true);
  });

  it('rejects NUL-bearing text and mismatched OOXML content', async () => {
    expect(await hasExpectedDocumentSignature(new Blob([new Uint8Array([0x61, 0x00])]), 'txt')).toBe(false);
    expect(await hasExpectedDocumentSignature(bytes('PK\u0003\u0004 [Content_Types].xml ppt/presentation.xml'), 'docx')).toBe(false);
  });

  it('maps accepted extensions to their server-enforced MIME type', () => {
    expect(expectedDocumentMimeType('pdf')).toBe('application/pdf');
    expect(expectedDocumentMimeType('docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('blocks new legacy OLE uploads until quarantine is available', () => {
    expect(isUploadableDocumentExtension('doc')).toBe(false);
    expect(isUploadableDocumentExtension('ppt')).toBe(false);
    expect(isUploadableDocumentExtension('docx')).toBe(true);
    expect(isUploadableDocumentExtension('pptx')).toBe(true);
  });
});
