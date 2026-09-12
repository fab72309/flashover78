import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MainCouranteFormData } from '../types';
import { formatMainCouranteDate } from './mainCourante';

const PDF_MIME_TYPE = 'application/pdf';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const NAVY = rgb(18 / 255, 35 / 255, 58 / 255);
const PRIMARY = rgb(51 / 255, 116 / 255, 181 / 255);
const PRIMARY_LIGHT = rgb(232 / 255, 241 / 255, 250 / 255);
const SURFACE = rgb(247 / 255, 249 / 255, 252 / 255);
const OUTLINE = rgb(205 / 255, 216 / 255, 229 / 255);
const BODY = rgb(43 / 255, 58 / 255, 77 / 255);
const MUTED = rgb(93 / 255, 108 / 255, 126 / 255);
const WHITE = rgb(1, 1, 1);

type PdfPage = ReturnType<PDFDocument['addPage']>;
type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

interface PdfRow {
  label: string;
  value: string;
}

interface RenderState {
  pdf: PDFDocument;
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

function drawPageHeader(page: PdfPage, regularFont: PdfFont, continuation = false) {
  if (continuation) {
    page.drawRectangle({
      x: 0,
      y: page.getHeight() - 48,
      width: page.getWidth(),
      height: 48,
      color: NAVY,
    });
    page.drawText('FLASHOVER 78 - MAIN COURANTE', {
      x: PAGE_MARGIN,
      y: page.getHeight() - 31,
      size: 11,
      font: regularFont,
      color: WHITE,
    });
    return;
  }

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 104,
    width: page.getWidth(),
    height: 104,
    color: NAVY,
  });
}

function drawFooter(page: PdfPage, pageNumber: number, pageCount: number, font: PdfFont) {
  page.drawLine({
    start: { x: PAGE_MARGIN, y: 30 },
    end: { x: page.getWidth() - PAGE_MARGIN, y: 30 },
    thickness: 0.6,
    color: OUTLINE,
  });
  page.drawText('Flashover 78 - Main courante groupe de formateurs', {
    x: PAGE_MARGIN,
    y: 17,
    size: 7.5,
    font,
    color: MUTED,
  });
  const pageLabel = `Page ${pageNumber}/${pageCount}`;
  page.drawText(pageLabel, {
    x: page.getWidth() - PAGE_MARGIN - font.widthOfTextAtSize(pageLabel, 7.5),
    y: 17,
    size: 7.5,
    font,
    color: MUTED,
  });
}

function addContinuationPage(state: RenderState, regularFont: PdfFont, emphasisFont: PdfFont) {
  state.page = state.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageHeader(state.page, regularFont, true);
  state.page.drawText('Suite du document', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 76,
    size: 9,
    font: regularFont,
    color: MUTED,
  });
  state.cursorTop = 96;
  void emphasisFont;
}

function ensureSpace(state: RenderState, requiredHeight: number, regularFont: PdfFont, emphasisFont: PdfFont) {
  if (state.cursorTop + requiredHeight <= PAGE_HEIGHT - 44) return;
  addContinuationPage(state, regularFont, emphasisFont);
}

function drawSectionTitle(state: RenderState, title: string, emphasisFont: PdfFont, regularFont: PdfFont) {
  ensureSpace(state, 42, regularFont, emphasisFont);
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
    ensureSpace(state, rowHeight + 8, regularFont, emphasisFont);

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
    const availableHeight = PAGE_HEIGHT - 44 - state.cursorTop;
    const maxLines = Math.max(1, Math.floor((availableHeight - 38) / lineHeight));
    if (maxLines < 1) {
      addContinuationPage(state, regularFont, emphasisFont);
      continue;
    }

    const chunk = lines.slice(0, maxLines);
    lines = lines.slice(maxLines);
    const height = Math.max(58, 34 + chunk.length * lineHeight);
    ensureSpace(state, height + 8, regularFont, emphasisFont);
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
      addContinuationPage(state, regularFont, emphasisFont);
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

  if (data.siteFormation === 'Poissy') {
    return [
      { label: 'Masques FFP3', value: scaleValue(data.masquesFfp3, 10, '1 à 10') },
      { label: 'Gants Nitrile', value: scaleValue(data.gantsNitrile, 10, '1 à 10') },
      { label: 'Benne à déchet', value: scaleValue(data.benneDechet, 5, 'Vide à Pleine') },
      { label: 'Panneaux de bois', value: scaleValue(data.panneauxBois, 10, '1 brulage à 10 brulages') },
      { label: 'Palettes', value: scaleValue(data.palettes, 10, '1 brulage à 10 brulages') },
      { label: 'Chariot foyer de démarrage', value: data.chariotFoyerDemarrage.join(', ') || 'Non renseigné' },
    ];
  }

  return [
    { label: 'Masques FFP3', value: scaleValue(data.masquesFfp3, 10, '1 à 10') },
    { label: 'Gants Nitrile', value: scaleValue(data.gantsNitrile, 10, '1 à 10') },
    { label: 'Palettes', value: scaleValue(data.palettes, 10, '1 brulage à 10 brulages') },
  ];
}

export async function renderMainCourantePdf(data: MainCouranteFormData) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const emphasisFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const state: RenderState = { pdf, page, cursorTop: 122 };

  drawPageHeader(page, regularFont);
  page.drawText('FLASHOVER 78', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 34,
    size: 10,
    font: emphasisFont,
    color: rgb(185 / 255, 213 / 255, 238 / 255),
  });
  page.drawText('MAIN COURANTE', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 67,
    size: 24,
    font: emphasisFont,
    color: WHITE,
  });
  page.drawText('Groupe de formateurs incendie de structure', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 88,
    size: 9.5,
    font: regularFont,
    color: WHITE,
  });

  drawSectionTitle(state, 'Synthèse de la session', emphasisFont, regularFont);
  drawGrid(state, [
    { label: 'Date', value: formatMainCouranteDate(data.dateMainCourante) },
    { label: 'Site de formation', value: displayValue(data.siteFormation) },
    { label: 'Type de session', value: displayValue(data.typeSession, 'Non applicable') },
    { label: 'Formation', value: displayValue(data.formation, 'Non applicable') },
  ], regularFont, emphasisFont);

  drawSectionTitle(state, 'Formateur et participants', emphasisFont, regularFont);
  drawGrid(state, [
    { label: 'Adresse email du formateur (SDIS78.FR)', value: displayValue(data.emailFormateur) },
    { label: 'Formateur N° 1', value: displayValue(data.formateurs[0]) },
    { label: 'Formateur N° 2', value: displayValue(data.formateurs[1]) },
    { label: 'Formateur N° 3', value: displayValue(data.formateurs[2]) },
    { label: 'Formateur N° 4', value: displayValue(data.formateurs[3]) },
    { label: 'Formateur N° 5', value: displayValue(data.formateurs[4]) },
  ], regularFont, emphasisFont);

  drawSectionTitle(state, 'Conditions extérieures', emphasisFont, regularFont);
  drawGrid(state, [
    { label: 'Vent', value: scaleValue(data.vent, 5, 'Faible à Fort') },
    { label: 'Sens du vent', value: displayValue(data.sensDuVent) },
    { label: 'Météo', value: data.meteo.join(', ') || 'Non renseignée' },
  ], regularFont, emphasisFont);

  drawSectionTitle(state, `Éléments du site - ${displayValue(data.siteFormation)}`, emphasisFont, regularFont);
  drawGrid(state, getSiteRows(data), regularFont, emphasisFont);

  drawSectionTitle(state, 'Observations et réparations', emphasisFont, regularFont);
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
  pages.forEach((pdfPage, index) => drawFooter(pdfPage, index + 1, pages.length, regularFont));
  pdf.setTitle(`Main courante - ${displayValue(data.siteFormation)}`);
  pdf.setAuthor('Flashover 78');
  pdf.setSubject('Main courante du groupe de formateurs incendie de structure');

  const bytes = await pdf.save();
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  return new Blob([pdfArrayBuffer], { type: PDF_MIME_TYPE });
}
