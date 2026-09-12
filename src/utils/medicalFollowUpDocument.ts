import { unzipSync, zipSync } from 'fflate';
import type { MedicalFollowUpFormData } from '../types';
import {
  formatMedicalFollowUpDate,
  MEDICAL_FOLLOWUP_DOCX_TEMPLATE_PATH,
  isMedicalFollowUpLocationWithDetails,
} from './medicalFollowUp';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_TEXT_NODE_PATTERN = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;

interface TextNode {
  contentStart: number;
  contentEnd: number;
  text: string;
}

interface TextPosition {
  nodeIndex: number;
  offset: number;
}

interface ReplacementMatch {
  start: number;
  end: number;
  value: string;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function encodeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collectTextNodes(xml: string) {
  const nodes: TextNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = WORD_TEXT_NODE_PATTERN.exec(xml)) !== null) {
    nodes.push({
      contentStart: match.index + match[0].indexOf(match[2]),
      contentEnd: match.index + match[0].indexOf(match[2]) + match[2].length,
      text: decodeXmlText(match[2]),
    });
  }

  WORD_TEXT_NODE_PATTERN.lastIndex = 0;
  return nodes;
}

function replaceTextAcrossWordRuns(xml: string, replacements: Record<string, string>) {
  const nodes = collectTextNodes(xml);
  const plainText = nodes.map((node) => node.text).join('');
  const positions: TextPosition[] = [];

  nodes.forEach((node, nodeIndex) => {
    for (let offset = 0; offset < node.text.length; offset += 1) {
      positions.push({ nodeIndex, offset });
    }
  });

  const matches: ReplacementMatch[] = [];
  Object.entries(replacements).forEach(([placeholder, value]) => {
    let searchFrom = 0;
    let index = plainText.indexOf(`{{${placeholder}}}`, searchFrom);
    while (index !== -1) {
      matches.push({
        start: index,
        end: index + placeholder.length + 4,
        value,
      });
      searchFrom = index + placeholder.length + 4;
      index = plainText.indexOf(`{{${placeholder}}}`, searchFrom);
    }
  });

  matches.sort((first, second) => second.start - first.start);

  matches.forEach((match) => {
    const startPosition = positions[match.start];
    const endPosition = positions[match.end - 1];
    if (!startPosition || !endPosition) return;

    if (startPosition.nodeIndex === endPosition.nodeIndex) {
      const node = nodes[startPosition.nodeIndex];
      node.text = `${node.text.slice(0, startPosition.offset)}${match.value}${node.text.slice(endPosition.offset + 1)}`;
      return;
    }

    const firstNode = nodes[startPosition.nodeIndex];
    firstNode.text = `${firstNode.text.slice(0, startPosition.offset)}${match.value}`;

    for (let nodeIndex = startPosition.nodeIndex + 1; nodeIndex < endPosition.nodeIndex; nodeIndex += 1) {
      nodes[nodeIndex].text = '';
    }

    const lastNode = nodes[endPosition.nodeIndex];
    lastNode.text = lastNode.text.slice(endPosition.offset + 1);
  });

  if (matches.length === 0) return xml;

  let result = '';
  let cursor = 0;
  nodes.forEach((node) => {
    result += xml.slice(cursor, node.contentStart);
    result += encodeXmlText(node.text);
    cursor = node.contentEnd;
  });
  return result + xml.slice(cursor);
}

function joinChoice(choice: string, other: string) {
  if (other.trim() && (choice === 'Autre :' || isMedicalFollowUpLocationWithDetails(choice as MedicalFollowUpFormData['lieuFormation']))) {
    return `${choice} ${other.trim()}`;
  }
  return choice || 'Non renseigné';
}

function getDocumentReplacements(data: MedicalFollowUpFormData) {
  const observations = data.observationsPostBrulage
    .map((observation) => observation === 'Autre :' && data.observationsPostBrulageAutre.trim()
      ? `${observation} ${data.observationsPostBrulageAutre.trim()}`
      : observation)
    .join(', ');
  const freeObservations = data.observations.trim();
  const observationsText = [observations, freeObservations ? `Observations : ${freeObservations}` : '']
    .filter(Boolean)
    .join(' | ');
  const typeBrulage = data.typeBrulage === 'Feux réels' && data.typeBrulageAutre.trim()
    ? `${data.typeBrulage} - ${data.typeBrulageAutre.trim()} mise(s) à feu`
    : data.typeBrulage || 'Non renseigné';

  return {
    NomFormateur: data.nomFormateur.trim(),
    PrenomFormateur: data.prenomFormateur.trim(),
    EmailFormateur: data.emailFormateur.trim(),
    TypeBrulage: typeBrulage,
    LieuFormation: joinChoice(data.lieuFormation, data.lieuFormationAutre),
    Formation: joinChoice(data.formation, data.formationAutre),
    DateFormation: formatMedicalFollowUpDate(data.dateFormation),
    Journée: data.journee || 'Non précisée',
    'ConditionsMétéo': data.conditionsMeteo || 'Non renseignées',
    Température: data.temperature.trim() || 'Non renseignée',
    HydratationAvantBrulage: data.hydratationAvantBrulage || 'Non renseignée',
    HydratationApresBrulage: data.hydratationApresBrulage || 'Non renseignée',
    'RôleFormateur': joinChoice(data.roleFormateur, data.roleFormateurAutre),
    TempsAri: data.tempsAri || 'Non renseigné',
    Déconta: data.decontaminationPostBrulage || 'Non renseignée',
    DoucheHeure: data.doucheDansHeure || 'Non renseignée',
    ObservationPostBrulage: observationsText || 'Non renseignée',
  };
}

function isWordXmlPart(path: string) {
  return path === 'word/document.xml' || /^word\/(?:header|footer)\d+\.xml$/.test(path);
}

export async function renderMedicalFollowUpDocument(data: MedicalFollowUpFormData) {
  const response = await fetch(MEDICAL_FOLLOWUP_DOCX_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error('Le modèle de fiche de suivi médical est indisponible.');
  }

  const sourceArchive = new Uint8Array(await response.arrayBuffer());
  const archive = unzipSync(sourceArchive);
  const replacements = getDocumentReplacements(data);
  const updatedArchive: Record<string, Uint8Array> = {};

  Object.entries(archive).forEach(([path, content]) => {
    updatedArchive[path] = isWordXmlPart(path)
      ? new TextEncoder().encode(replaceTextAcrossWordRuns(new TextDecoder().decode(content), replacements))
      : content;
  });

  return new Blob([zipSync(updatedArchive)], { type: DOCX_MIME_TYPE });
}
