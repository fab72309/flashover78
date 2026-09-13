import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MainCouranteFormData } from '../types';
import {
  formatMainCouranteDate,
  MAIN_COURANTE_RENDER_TEMPLATE_URL,
} from './mainCourante';

const PDF_MIME_TYPE = 'application/pdf';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const PRIMARY = rgb(68 / 255, 114 / 255, 196 / 255);
const PRIMARY_LIGHT = rgb(221 / 255, 235 / 255, 247 / 255);
const SURFACE = rgb(255 / 255, 255 / 255, 255 / 255);
const OUTLINE = rgb(91 / 255, 155 / 255, 213 / 255);
const BODY = rgb(43 / 255, 58 / 255, 77 / 255);
const MUTED = rgb(93 / 255, 108 / 255, 126 / 255);
const WHITE = rgb(1, 1, 1);
const TEMPLATE_PAGE_NUMBER_X = 505;
const TEMPLATE_PAGE_NUMBER_RIGHT = 520;
const TEMPLATE_PAGE_NUMBER_Y = 10;
const TEMPLATE_PAGE_NUMBER_WIDTH = 24;
const TEMPLATE_PAGE_NUMBER_HEIGHT = 18;
const BODY_TOP = 145;
const BODY_BOTTOM = PAGE_HEIGHT - 48;

type PdfPage = ReturnType<PDFDocument['addPage']>;
type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>;
type PdfEmbeddedPage = Awaited<ReturnType<PDFDocument['embedPage']>>;

interface PdfRow {
  label: string;
  value: string;
}

interface RenderState {
  pdf: PDFDocument;
  templateBackground: PdfEmbeddedPage;
  page: PdfPage;
  cursorTop: number;
}

function pdfSafeText(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE');
}

function displayValue(value: string | null | undefined, fallback = 'Non renseigné') {
  return value?.trim() || fallback;
}

function wrapText(font: PdfFont, value: string, fontSize: number, width: number) {
  const paragraphs = pdfSafeText(value || 'Non renseigné').split(/\r?\n/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }

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
  });

  return lines.length > 0 ? lines : ['Non renseigné'];
}

function pageY(page: PdfPage, top: number, height = 0) {
  return page.getHeight() - top - height;
}

function drawTemplateBackground(page: PdfPage, templateBackground: PdfEmbeddedPage) {
  page.drawPage(templateBackground, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
}

function drawTemplatePageNumber(page: PdfPage, pageNumber: number, font: PdfFont) {
  page.drawRectangle({
    x: TEMPLATE_PAGE_NUMBER_X,
    y: TEMPLATE_PAGE_NUMBER_Y,
    width: TEMPLATE_PAGE_NUMBER_WIDTH,
    height: TEMPLATE_PAGE_NUMBER_HEIGHT,
    color: WHITE,
  });
  const pageLabel = String(pageNumber);
  page.drawText(pageLabel, {
    x: TEMPLATE_PAGE_NUMBER_RIGHT - font.widthOfTextAtSize(pageLabel, 9),
    y: 14,
    size: 9,
    font,
    color: rgb(128 / 255, 128 / 255, 128 / 255),
  });
}

function addContinuationPage(state: RenderState) {
  state.page = state.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawTemplateBackground(state.page, state.templateBackground);
  state.cursorTop = BODY_TOP;
}

function ensureSpace(state: RenderState, requiredHeight: number) {
  if (state.cursorTop + requiredHeight <= BODY_BOTTOM) return;
  addContinuationPage(state);
}

function drawSectionTitle(state: RenderState, title: string, emphasisFont: PdfFont) {
  ensureSpace(state, 42);
  const height = 28;
  state.page.drawRectangle({
    x: PAGE_MARGIN,
    y: pageY(state.page, state.cursorTop, height),
    width: CONTENT_WIDTH,
    height,
    color: PRIMARY_LIGHT,
  });
  state.page.drawText(pdfSafeText(title), {
    x: PAGE_MARGIN + 12,
    y: pageY(state.page, state.cursorTop, height) + 9,
    size: 11,
    font: emphasisFont,
    color: PRIMARY,
  });
  state.cursorTop += height + 10;
}

function drawGrid(
  state: RenderState,
  rows: PdfRow[],
  regularFont: PdfFont,
  emphasisFont: PdfFont,
) {
  const gap = 12;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;
  const labelSize = 7.5;
  const valueSize = 10;
  const lineHeight = 13;

  for (let index = 0; index < rows.length; index += 2) {
    const pair = rows.slice(index, index + 2);
    const wrapped = pair.map((row) => wrapText(regularFont, row.value, valueSize, columnWidth - 24));
    const rowHeight = Math.max(48, ...wrapped.map((lines) => 26 + lines.length * lineHeight));
    ensureSpace(state, rowHeight + 8);

    pair.forEach((row, pairIndex) => {
      const x = PAGE_MARGIN + pairIndex * (columnWidth + gap);
      const y = pageY(state.page, state.cursorTop, rowHeight);
      state.page.drawRectangle({
        x,
        y,
        width: columnWidth,
        height: rowHeight,
        color: SURFACE,
        borderColor: OUTLINE,
        borderWidth: 0.6,
      });
      state.page.drawText(pdfSafeText(row.label).toUpperCase(), {
        x: x + 12,
        y: y + rowHeight - 16,
        size: labelSize,
        font: emphasisFont,
        color: MUTED,
      });
      wrapped[pairIndex].forEach((line, lineIndex) => {
        state.page.drawText(line || ' ', {
          x: x + 12,
          y: y + rowHeight - 34 - lineIndex * lineHeight,
          size: valueSize,
          font: regularFont,
          color: BODY,
        });
      });
    });

    state.cursorTop += rowHeight + 8;
  }
}

function drawFullField(
  state: RenderState,
  label: string,
  value: string,
  regularFont: PdfFont,
  emphasisFont: PdfFont,
) {
  const valueSize = 10;
  const lineHeight = 13;
  const contentWidth = CONTENT_WIDTH - 24;
  let lines = wrapText(regularFont, value, valueSize, contentWidth);
  let isContinuation = false;

  while (lines.length > 0) {
    const availableHeight = BODY_BOTTOM - state.cursorTop;
    if (availableHeight < 66) {
      addContinuationPage(state);
      continue;
    }
    const maxLines = Math.max(1, Math.floor((availableHeight - 42) / lineHeight));

    const chunk = lines.slice(0, maxLines);
    lines = lines.slice(maxLines);
    const height = Math.max(58, 34 + chunk.length * lineHeight);
    ensureSpace(state, height + 8);
    const y = pageY(state.page, state.cursorTop, height);
    state.page.drawRectangle({
      x: PAGE_MARGIN,
      y,
      width: CONTENT_WIDTH,
      height,
      color: SURFACE,
      borderColor: OUTLINE,
      borderWidth: 0.6,
    });
    state.page.drawText(pdfSafeText(isContinuation ? `${label} - suite` : label).toUpperCase(), {
      x: PAGE_MARGIN + 12,
      y: y + height - 16,
      size: 7.5,
      font: emphasisFont,
      color: MUTED,
    });
    chunk.forEach((line, lineIndex) => {
      state.page.drawText(line || ' ', {
        x: PAGE_MARGIN + 12,
        y: y + height - 34 - lineIndex * lineHeight,
        size: valueSize,
        font: regularFont,
        color: BODY,
      });
    });
    state.cursorTop += height + 8;
    isContinuation = true;

    if (lines.length > 0) {
      addContinuationPage(state);
    }
  }
}

function scaleValue(value: string, maximum: number, range: string) {
  return value ? `${value}/${maximum} - ${range}` : 'Non renseigné';
}

function getSiteRows(data: MainCouranteFormData): PdfRow[] {
  if (data.siteFormation === 'Montigny le Bretonneux') {
    return [
      { label: 'Citerne de gaz :', value: scaleValue(data.citerneGaz, 10, '0% à 100%') },
      { label: 'Panneaux de bois', value: scaleValue(data.panneauxBois, 10, '1 brulage à 10 brulages') },
      { label: 'Palettes', value: scaleValue(data.palettes, 10, '1 brulage à 10 brulages') },
      { label: 'Masques FFP3', value: scaleValue(data.masquesFfp3, 10, '1 à 10') },
      { label: 'Gants Nitrile', value: scaleValue(data.gantsNitrile, 10, '1 à 10') },
      { label: 'Benne à déchet', value: scaleValue(data.benneDechet, 5, 'Vide à Pleine') },
      { label: 'Chariot foyer de démarrage', value: data.chariotFoyerDemarrage.join(', ') || 'Non renseigné' },
    ];
  }

  return [
    { label: 'Masques FFP3', value: scaleValue(data.masquesFfp3, 10, '1 à 10') },
    { label: 'Gants Nitrile', value: scaleValue(data.gantsNitrile, 10, '1 à 10') },
    { label: 'Palettes', value: scaleValue(data.palettes, 10, '1 brulage à 10 brulages') },
  ];
}

function getFormationValue(data: MainCouranteFormData) {
  if (data.formation !== 'Autre :') {
    return displayValue(data.formation, 'Non applicable');
  }

  return data.formationAutre.trim()
    ? `Autre : ${data.formationAutre.trim()}`
    : 'Autre : Non précisée';
}

function getLocationValue(data: MainCouranteFormData) {
  if (data.lieuFormation === 'Friche batimentaire' || data.lieuFormation === 'Autre :') {
    return data.lieuFormationAutre.trim()
      ? `${data.lieuFormation} ${data.lieuFormationAutre.trim()}`
      : `${data.lieuFormation} Non précisé`;
  }

  return displayValue(data.lieuFormation, 'Non renseigné');
}

function getBurningTypeValue(data: MainCouranteFormData) {
  if (data.typeBrulage === 'Feux réels' && data.typeBrulageAutre.trim()) {
    return `${data.typeBrulage} - ${data.typeBrulageAutre.trim()} mise(s) à feu`;
  }

  return displayValue(data.typeBrulage);
}

function getFormateurRows(data: MainCouranteFormData): PdfRow[] {
  const formateurRows = data.formateurs
    .map((name, index) => {
      const trimmedName = name.trim();
      if (!trimmedName) return null;

      const role = data.formateurRoles[index];
      return {
        label: `Formateur N° ${index + 1}${role ? ` - ${role}` : ''}`,
        value: trimmedName,
      };
    })
    .filter((row): row is PdfRow => row !== null);

  return [
    { label: 'Adresse email du formateur (SDIS78.FR)', value: displayValue(data.emailFormateur) },
    ...(formateurRows.length > 0
      ? formateurRows
      : [{ label: 'Formateurs', value: 'Aucun formateur sélectionné' }]),
  ];
}

export async function renderMainCourantePdf(data: MainCouranteFormData) {
  const templateResponse = await fetch(MAIN_COURANTE_RENDER_TEMPLATE_URL, { cache: 'no-store' });
  if (!templateResponse.ok) {
    throw new Error('Le modèle PDF de main courante est indisponible.');
  }

  const templatePdf = await PDFDocument.load(await templateResponse.arrayBuffer());
  const templatePage = templatePdf.getPages()[0];
  if (!templatePage) {
    throw new Error('Le modèle PDF de main courante ne contient aucune page.');
  }

  const pdf = await PDFDocument.create();
  const templateBackground = await pdf.embedPage(templatePage);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const emphasisFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawTemplateBackground(page, templateBackground);
  const state: RenderState = {
    pdf,
    templateBackground,
    page,
    cursorTop: BODY_TOP,
  };

  drawSectionTitle(state, 'Synthèse de la session', emphasisFont);
  drawGrid(state, [
    { label: 'Date', value: formatMainCouranteDate(data.dateMainCourante) },
    { label: 'Site de formation', value: displayValue(data.siteFormation) },
    { label: 'Lieu de formation', value: getLocationValue(data) },
    { label: 'Type de session', value: displayValue(data.typeSession, 'Non applicable') },
    { label: 'Formation', value: getFormationValue(data) },
    { label: 'Type de brûlage', value: getBurningTypeValue(data) },
  ], regularFont, emphasisFont);

  drawSectionTitle(state, 'Formateur et participants', emphasisFont);
  drawGrid(state, getFormateurRows(data), regularFont, emphasisFont);

  drawSectionTitle(state, 'Conditions extérieures', emphasisFont);
  drawGrid(state, [
    { label: 'Vent', value: scaleValue(data.vent, 5, 'Faible à Fort') },
    { label: 'Sens du vent', value: displayValue(data.sensDuVent) },
    { label: 'Météo', value: data.meteo.join(', ') || 'Non renseignée' },
  ], regularFont, emphasisFont);

  drawSectionTitle(state, `Éléments du site - ${displayValue(data.siteFormation)}`, emphasisFont);
  drawGrid(state, getSiteRows(data), regularFont, emphasisFont);

  drawSectionTitle(state, 'Observations et réparations', emphasisFont);
  drawFullField(
    state,
    'Observations, difficultés rencontrées',
    displayValue(data.observationsDifficultes),
    regularFont,
    emphasisFont,
  );
  drawFullField(
    state,
    'Réparations, remplacement de matériel à prévoir',
    displayValue(data.reparationsMateriel),
    regularFont,
    emphasisFont,
  );

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => drawTemplatePageNumber(pdfPage, index + 1, regularFont));
  pdf.setTitle(`Main courante - ${displayValue(data.siteFormation)}`);
  pdf.setAuthor('Flashover 78');
  pdf.setSubject('Main courante du groupe de formateurs incendie de structure');

  const bytes = await pdf.save();
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  return new Blob([pdfArrayBuffer], { type: PDF_MIME_TYPE });
}
