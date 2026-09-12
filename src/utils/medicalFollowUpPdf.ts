import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MedicalFollowUpFormData } from '../types';
import {
  formatMedicalFollowUpDate,
  MEDICAL_FOLLOWUP_TEMPLATE_PATH,
  isMedicalFollowUpLocationWithDetails,
} from './medicalFollowUp';

const PDF_MIME_TYPE = 'application/pdf';
const VALUE_COLOR = rgb(46 / 255, 116 / 255, 181 / 255);
const HEADER_COLOR = rgb(51 / 255, 116 / 255, 181 / 255);
const WHITE = rgb(1, 1, 1);

interface FieldPosition {
  x: number;
  top: number;
  width: number;
  height: number;
}

function pdfSafeText(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE');
}

function fitFontSize(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  width: number,
  initialSize: number,
  minimumSize = 5.5,
) {
  let size = initialSize;
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > width) {
    size -= 0.25;
  }
  return size;
}

function drawField(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  value: string,
  position: FieldPosition,
  options: { background?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb>; fontSize?: number } = {},
) {
  const pageHeight = page.getHeight();
  const background = options.background ?? WHITE;
  const color = options.color ?? VALUE_COLOR;
  const text = pdfSafeText(value || 'Non renseigné');
  const padding = 2;
  const boxY = pageHeight - position.top - position.height - padding;
  page.drawRectangle({
    x: position.x - padding,
    y: boxY,
    width: position.width + padding * 2,
    height: position.height + padding * 2,
    color: background,
  });

  const fontSize = fitFontSize(font, text, position.width, options.fontSize ?? 10.5);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const baselineY = pageHeight - position.top - position.height + Math.max(0, (position.height - fontSize) / 2) - 1;
  page.drawText(text, {
    x: position.x,
    y: baselineY,
    size: fontSize,
    font,
    color,
  });

  return textWidth;
}

function wrapText(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  fontSize: number,
  width: number,
) {
  const words = pdfSafeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, fontSize) > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['Non renseignée'];
}

function drawMultilineField(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  value: string,
  position: FieldPosition,
) {
  const pageHeight = page.getHeight();
  const padding = 2;
  const boxY = pageHeight - position.top - position.height - padding;
  page.drawRectangle({
    x: position.x - padding,
    y: boxY,
    width: position.width + padding * 2,
    height: position.height + padding * 2,
    color: WHITE,
  });

  const fontSize = 9;
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(font, value, fontSize, position.width);
  const visibleLines = lines.slice(0, Math.max(1, Math.floor((position.height - 2) / lineHeight)));
  const firstBaseline = pageHeight - position.top - fontSize - 1;

  visibleLines.forEach((line, index) => {
    page.drawText(line, {
      x: position.x,
      y: firstBaseline - index * lineHeight,
      size: fontSize,
      font,
      color: VALUE_COLOR,
    });
  });
}

function joinChoice(choice: string, other: string) {
  if (choice === 'Autre :' && other.trim()) return `${choice} ${other.trim()}`;
  if (isMedicalFollowUpLocationWithDetails(choice as MedicalFollowUpFormData['lieuFormation']) && other.trim()) {
    return `${choice} ${other.trim()}`;
  }
  return choice || 'Non renseigné';
}

function getLocationValues(data: MedicalFollowUpFormData) {
  const location = data.lieuFormation || 'Non renseigné';
  const detail = isMedicalFollowUpLocationWithDetails(data.lieuFormation)
    ? data.lieuFormationAutre.trim()
    : '';
  return {
    full: joinChoice(location, detail),
    principal: location,
    detail,
  };
}

function getPdfValues(data: MedicalFollowUpFormData) {
  const location = getLocationValues(data);
  const observations = data.observationsPostBrulage
    .map((observation) => observation === 'Autre :' && data.observationsPostBrulageAutre.trim()
      ? `${observation} ${data.observationsPostBrulageAutre.trim()}`
      : observation)
    .join(', ');
  const freeObservations = data.observations.trim();
  const typeBrulage = data.typeBrulage === 'Feux réels' && data.typeBrulageAutre.trim()
    ? `${data.typeBrulage} - ${data.typeBrulageAutre.trim()} mise(s) à feu`
    : data.typeBrulage || 'Non renseigné';

  return {
    nom: data.nomFormateur.trim(),
    prenom: data.prenomFormateur.trim(),
    email: data.emailFormateur.trim(),
    lieu: location.full,
    lieuPrincipal: location.principal,
    lieuDetail: location.detail,
    formation: joinChoice(data.formation, data.formationAutre),
    typeBrulage,
    date: formatMedicalFollowUpDate(data.dateFormation),
    journee: data.journee || 'Non précisée',
    meteo: data.conditionsMeteo || 'Non renseignées',
    temperature: data.temperature.trim() || 'Non renseignée',
    hydratationAvant: data.hydratationAvantBrulage || 'Non renseignée',
    hydratationApres: data.hydratationApresBrulage || 'Non renseignée',
    role: data.roleFormateur || 'Non renseigné',
    ari: data.tempsAri || 'Non renseigné',
    decontamination: data.decontaminationPostBrulage || 'Non renseignée',
    douche: data.doucheDansHeure || 'Non renseignée',
    observations: [observations, freeObservations ? `Observations : ${freeObservations}` : '']
      .filter(Boolean)
      .join(' | '),
  };
}

export async function renderMedicalFollowUpPdf(
  data: MedicalFollowUpFormData,
  options: { isEvolution?: boolean } = {},
) {
  const response = await fetch(MEDICAL_FOLLOWUP_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error('Le modèle PDF de fiche de suivi médical est indisponible.');
  }

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const values = getPdfValues(data);

  if (options.isEvolution) {
    page.drawRectangle({
      x: 197,
      y: page.getHeight() - 86,
      width: 236,
      height: 28,
      color: HEADER_COLOR,
    });
    const title = 'Evolution Suivi médical';
    const titleSize = fitFontSize(font, title, 226, 18, 12);
    page.drawText(title, {
      x: 315 - font.widthOfTextAtSize(title, titleSize) / 2,
      y: page.getHeight() - 79,
      size: titleSize,
      font,
      color: WHITE,
    });
  }

  drawField(page, font, values.lieu, { x: 263, top: 84, width: 93, height: 18 }, {
    background: HEADER_COLOR,
    color: WHITE,
    fontSize: 10,
  });
  page.drawText(`Fonction : ${pdfSafeText(data.trainerLevel)}`, {
    x: 263,
    y: page.getHeight() - 116,
    size: 7.5,
    font,
    color: WHITE,
  });

  drawField(page, font, values.nom, { x: 72, top: 198, width: 130, height: 19 });
  drawField(page, font, values.prenom, { x: 207, top: 198, width: 151, height: 19 });
  drawField(page, font, values.email, { x: 72, top: 218, width: 138, height: 19 });
  drawField(page, font, values.typeBrulage, { x: 222, top: 278, width: 150, height: 25 }, { fontSize: 11 });
  drawField(page, font, values.lieuPrincipal, { x: 174, top: 341, width: 94, height: 16 }, { fontSize: 9 });
  if (values.lieuDetail) {
    drawField(page, font, `Précision : ${values.lieuDetail}`, { x: 174, top: 357, width: 122, height: 14 }, { fontSize: 7.5 });
  }
  drawField(page, font, values.formation, { x: 403, top: 341, width: 75, height: 16 }, { fontSize: 9.5 });
  drawField(page, font, values.date, { x: 188, top: 432, width: 96, height: 16 });
  drawField(page, font, values.journee, { x: 288, top: 432, width: 64, height: 16 }, { fontSize: 9.5 });
  drawField(page, font, values.meteo, { x: 174, top: 461, width: 109, height: 16 }, { fontSize: 9.5 });
  drawField(page, font, values.temperature, { x: 375, top: 461, width: 84, height: 16 });
  drawField(page, font, values.hydratationAvant, { x: 217, top: 505, width: 153, height: 16 });
  drawField(page, font, values.hydratationApres, { x: 218, top: 520, width: 152, height: 16 });
  drawField(page, font, values.role, { x: 157, top: 563, width: 97, height: 16 });
  drawField(page, font, values.ari, { x: 363, top: 563, width: 70, height: 16 });
  drawField(page, font, values.decontamination, { x: 242, top: 606, width: 64, height: 16 });
  drawField(page, font, values.douche, { x: 190, top: 650, width: 91, height: 16 });
  drawMultilineField(page, font, values.observations || 'Non renseignée', {
    x: 220,
    top: 707,
    width: 295,
    height: 48,
  });

  pdf.setTitle(options.isEvolution ? 'Evolution Suivi médical' : 'Suivi médical formateur');
  pdf.setAuthor('Flashover 78');
  const bytes = await pdf.save();
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  return new Blob([pdfArrayBuffer], { type: PDF_MIME_TYPE });
}
