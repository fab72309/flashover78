import type { BrulageDocumentSectionId, Resource, ResourceCategory } from '../types';
export type { BrulageDocumentSectionId } from '../types';

export interface BrulageDocumentSectionDefinition {
  id: BrulageDocumentSectionId;
  label: string;
  description: string;
}

export const BRULAGE_DOCUMENT_SECTIONS: BrulageDocumentSectionDefinition[] = [
  {
    id: 'roles',
    label: 'Fiches de rôle',
    description: 'Repères et responsabilités des formateurs.',
  },
  {
    id: 'checklists',
    label: 'Checklists',
    description: 'Points de contrôle avant, pendant et après la séquence.',
  },
  {
    id: 'references',
    label: 'Documents de référence',
    description: 'Procédures, supports et documents utiles.',
  },
];

export function isBrulageDocumentCategory(category: ResourceCategory) {
  return category === 'BRULAGE_MAF' || category === 'BRULAGE_TDL_FO';
}

const ROLE_TERMS = [
  'fiche de role',
  'fiche role',
  'forbat',
  'for bat',
  'for inc',
  'rsfr',
];

const CHECKLIST_TERMS = [
  'checklist',
  'check list',
  'liste de controle',
  'liste de verification',
  'fiche de controle',
  'fiche de verification',
  'points de controle',
];

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}

function getSearchText(document: Pick<Resource, 'title' | 'tags' | 'originalFilename'>) {
  return normalizeSearchText([
    document.title,
    document.originalFilename,
    ...document.tags,
  ].join(' '));
}

export function getBrulageDocumentSection(
  document: Pick<Resource, 'title' | 'tags' | 'originalFilename' | 'documentSection'>
): BrulageDocumentSectionId {
  if (document.documentSection) {
    return document.documentSection;
  }

  const searchText = getSearchText(document);

  if (CHECKLIST_TERMS.some((term) => searchText.includes(term))) {
    return 'checklists';
  }

  if (ROLE_TERMS.some((term) => searchText.includes(term))) {
    return 'roles';
  }

  return 'references';
}

export function groupBrulageDocuments(documents: Resource[]) {
  const groups: Record<BrulageDocumentSectionId, Resource[]> = {
    roles: [],
    checklists: [],
    references: [],
  };

  documents.forEach((document) => {
    groups[getBrulageDocumentSection(document)].push(document);
  });

  return groups;
}
