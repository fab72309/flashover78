import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MedicalFollowUpFormData } from '../types';
import {
  formatMedicalFollowUpDate,
  MEDICAL_FOLLOWUP_RENDER_TEMPLATE_URL,
  isMedicalFollowUpLocationWithDetails,
} from './medicalFollowUp';

const PDF_MIME_TYPE = 'application/pdf';
const VALUE_COLOR = rgb(46 / 255, 116 / 255, 181 / 255);
const HEADER_COLOR = rgb(51 / 255, 116 / 255, 181 / 255);
const WHITE = rgb(1, 1, 1);
const BODY_TEXT_COLOR = rgb(18 / 255, 35 / 255, 58 / 255);

interface FieldPosition {
  x: number;
  top: number;
  width: number;
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

function drawValue(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  value: string,
  position: FieldPosition,
  options: {
    color?: ReturnType<typeof rgb>;
    fontSize?: number;
    minimumFontSize?: number;
    align?: 'left' | 'center';
    fallback?: string;
  } = {},
) {
  const pageHeight = page.getHeight();
  const color = options.color ?? VALUE_COLOR;
  const text = pdfSafeText(value || options.fallback || 'Non renseigné');
  const fontSize = fitFontSize(
    font,
    text,
    position.width,
    options.fontSize ?? 11,
    options.minimumFontSize ?? 7,
  );
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const baselineY = pageHeight - position.top - fontSize + 1.4;
  const x = options.align === 'center'
    ? position.x + Math.max(0, (position.width - textWidth) / 2)
    : position.x;
  page.drawText(text, {
    x,
    y: baselineY,
    size: fontSize,
    font,
    color,
  });

  return textWidth;
}

function getBaselineY(
  page: ReturnType<PDFDocument['getPages']>[number],
  top: number,
  fontSize: number,
) {
  return page.getHeight() - top - fontSize + 1.4;
}

function drawLabel(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  label: string,
  position: FieldPosition,
) {
  const fontSize = fitFontSize(font, label, position.width, 11, 9);
  const textWidth = drawValue(page, font, label, position, {
    color: BODY_TEXT_COLOR,
    fontSize,
    minimumFontSize: 9,
  });
  const baselineY = getBaselineY(page, position.top, fontSize);
  page.drawLine({
    start: { x: position.x, y: baselineY - 1.5 },
    end: { x: position.x + textWidth, y: baselineY - 1.5 },
    thickness: 0.65,
    color: BODY_TEXT_COLOR,
  });
}

function drawCenteredValue(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  value: string,
  position: FieldPosition,
  options: { color?: ReturnType<typeof rgb>; fontSize?: number; minimumFontSize?: number } = {},
) {
  return drawValue(page, font, value, position, { ...options, align: 'center' });
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
  const fontSize = 10;
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(font, value, fontSize, position.width);
  const visibleLines = lines.slice(0, 3);
  const firstBaseline = getBaselineY(page, position.top, fontSize);

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
  const response = await fetch(MEDICAL_FOLLOWUP_RENDER_TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Le modèle PDF de fiche de suivi médical est indisponible.');
  }

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const valueFont = await pdf.embedFont(StandardFonts.Helvetica);
  const emphasisFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const values = getPdfValues(data);

  if (options.isEvolution) {
    page.drawRectangle({
      x: 193,
      y: page.getHeight() - 91,
      width: 244,
      height: 34,
      color: HEADER_COLOR,
    });
    const title = 'Evolution Suivi médical';
    const titleSize = fitFontSize(emphasisFont, title, 232, 17, 12);
    page.drawText(title, {
      x: 315 - emphasisFont.widthOfTextAtSize(title, titleSize) / 2,
      y: page.getHeight() - 81,
      size: titleSize,
      font: emphasisFont,
      color: WHITE,
    });
  }

  drawCenteredValue(page, emphasisFont, values.lieu, { x: 145, top: 84.875, width: 255 }, {
    color: WHITE,
    fontSize: 10,
    minimumFontSize: 7.5,
  });
  page.drawText(`Fonction : ${pdfSafeText(data.trainerLevel)}`, {
    x: 263,
    y: page.getHeight() - 116.5,
    size: 8.5,
    font: emphasisFont,
    color: WHITE,
  });

  drawValue(page, emphasisFont, values.nom, { x: 72.1, top: 200.025, width: 130 }, {
    color: VALUE_COLOR,
    fontSize: 12,
  });
  drawValue(page, emphasisFont, values.prenom, { x: 206.965, top: 200.025, width: 153 }, {
    color: VALUE_COLOR,
    fontSize: 12,
  });
  drawValue(page, valueFont, values.email, { x: 72.1, top: 219.825, width: 138 }, {
    color: VALUE_COLOR,
    fontSize: 11.5,
  });
  drawCenteredValue(page, emphasisFont, values.typeBrulage, { x: 150, top: 279.4, width: 295 }, {
    color: BODY_TEXT_COLOR,
    fontSize: 15,
    minimumFontSize: 10,
  });
  drawLabel(page, emphasisFont, 'Lieu de formation :', { x: 72.1, top: 342.695, width: 225 });
  drawLabel(page, emphasisFont, 'Type de formation :', { x: 301.25, top: 342.695, width: 100 });
  drawValue(page, valueFont, values.lieuPrincipal, { x: 174.147, top: 342.695, width: 122 }, {
    fontSize: 10.5,
    minimumFontSize: 8,
  });
  if (values.lieuDetail) {
    drawValue(page, valueFont, `Précision : ${values.lieuDetail}`, { x: 174.147, top: 357.5, width: 122 }, {
      fontSize: 8.5,
      minimumFontSize: 6.5,
    });
  }
  drawValue(page, valueFont, values.formation, { x: 403.297, top: 342.695, width: 95 }, {
    fontSize: 10.5,
    minimumFontSize: 8,
  });
  drawLabel(page, emphasisFont, 'Date de la formation :', { x: 72.1, top: 433.695, width: 220 });
  drawLabel(page, emphasisFont, 'Conditions météo :', { x: 72.1, top: 462.695, width: 205 });
  drawLabel(page, emphasisFont, 'Température :', { x: 299.35, top: 462.695, width: 130 });
  drawValue(page, valueFont, values.date, { x: 187.6, top: 433.695, width: 97.5 }, { fontSize: 11 });
  drawValue(page, valueFont, values.journee, { x: 288.371, top: 433.695, width: 104 }, {
    fontSize: 9.5,
    minimumFontSize: 7,
  });
  drawValue(page, valueFont, values.meteo, { x: 174.747, top: 462.695, width: 106 }, {
    fontSize: 10.5,
    minimumFontSize: 8,
  });
  drawValue(page, valueFont, values.temperature, { x: 375.747, top: 462.695, width: 83.5 }, {
    fontSize: 10.5,
    minimumFontSize: 8,
  });
  drawLabel(page, emphasisFont, 'Hydratation avant brûlage :', { x: 72.1, top: 506.195, width: 220 });
  drawLabel(page, emphasisFont, 'Hydratation après brûlage :', { x: 72.1, top: 520.695, width: 220 });
  drawValue(page, valueFont, values.hydratationAvant, { x: 217.55, top: 506.195, width: 150 }, { fontSize: 11 });
  drawValue(page, valueFont, values.hydratationApres, { x: 218.147, top: 520.695, width: 150 }, { fontSize: 11 });
  drawLabel(page, emphasisFont, 'Rôle formateur :', { x: 72.1, top: 564.195, width: 180 });
  drawLabel(page, emphasisFont, 'Temps sous ARI :', { x: 267.597, top: 564.195, width: 110 });
  drawValue(page, valueFont, values.role, { x: 160.5, top: 564.195, width: 92 }, { fontSize: 11 });
  drawValue(page, valueFont, values.ari, { x: 363.547, top: 564.195, width: 67.8 }, { fontSize: 11 });
  drawLabel(page, emphasisFont, 'Décontamination post-brûlage :', { x: 72.1, top: 607.695, width: 245 });
  drawValue(page, valueFont, values.decontamination, { x: 242.6, top: 607.695, width: 60.5 }, { fontSize: 11 });
  drawLabel(page, emphasisFont, 'Douche dans l’heure :', { x: 72.1, top: 651.195, width: 205 });
  drawValue(page, valueFont, values.douche, { x: 190.05, top: 651.195, width: 88.5 }, { fontSize: 11 });
  drawLabel(page, emphasisFont, 'Observations post-brûlage :', { x: 72.1, top: 709.195, width: 260 });
  drawMultilineField(page, valueFont, values.observations || 'Non renseignée', {
    x: 220.6,
    top: 709.195,
    width: 294,
  });
  drawValue(page, valueFont, 'degrés', { x: 462.5, top: 462.695, width: 36 }, {
    color: BODY_TEXT_COLOR,
    fontSize: 10.5,
    minimumFontSize: 8,
  });

  pdf.setTitle(options.isEvolution ? 'Evolution Suivi médical' : 'Suivi médical formateur');
  pdf.setAuthor('Flashover 78');
  const bytes = await pdf.save();
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  return new Blob([pdfArrayBuffer], { type: PDF_MIME_TYPE });
}
