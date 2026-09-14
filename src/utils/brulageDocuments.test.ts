import { describe, expect, it } from 'vitest';
import {
  getBrulageDocumentSection,
  groupBrulageDocuments,
} from './brulageDocuments';
import type { Resource } from '../types';

function createDocument(
  title: string,
  tags: string[] = []
): Resource {
  return {
    id: title,
    title,
    category: 'BRULAGE_MAF',
    fileUrl: '',
    tags,
    versionLabel: '1.0',
    authorName: '',
    originalFilename: `${title}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 1024,
    bucketId: 'brulage-documents',
    storagePath: title,
    updatedAt: new Date('2026-09-13T10:00:00Z'),
    isFavorite: false,
    isOfflineSelected: false,
    versionCount: 1,
    createdAt: new Date('2026-09-13T10:00:00Z'),
  };
}

describe('brulageDocuments', () => {
  it('reconnaît les fiches de rôle et les checklists depuis les métadonnées', () => {
    expect(getBrulageDocumentSection(createDocument('Fiche de rôle FORBAT 4'))).toBe('roles');
    expect(getBrulageDocumentSection(createDocument('Contrôles avant séance', ['checklist']))).toBe('checklists');
  });

  it('range les documents non typés dans les références', () => {
    expect(getBrulageDocumentSection(createDocument('Procédure de sécurité MAF'))).toBe('references');
  });

  it('conserve chaque document dans une seule section', () => {
    const documents = [
      createDocument('Fiche de rôle RSFR'),
      createDocument('Checklist départ'),
      createDocument('Support de référence'),
    ];

    const groups = groupBrulageDocuments(documents);

    expect(groups.roles).toHaveLength(1);
    expect(groups.checklists).toHaveLength(1);
    expect(groups.references).toHaveLength(1);
    expect(Object.values(groups).flat()).toHaveLength(documents.length);
  });
});
