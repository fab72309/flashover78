import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { EquipmentRepairRequestFormData } from '../types';
import {
  formatEquipmentRepairRequestDate,
  getEquipmentRepairRequestEquipmentLabel,
  getEquipmentRepairRequestLocationLabel,
} from './equipmentRepairRequest';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BODY_TOP = 105;
const BODY_BOTTOM = PAGE_HEIGHT - 52;
const PRIMARY = rgb(38 / 255, 91 / 255, 143 / 255);
const PRIMARY_LIGHT = rgb(231 / 255, 240 / 255, 248 / 255);
const OUTLINE = rgb(167 / 255, 192 / 255, 214 / 255);
const SURFACE = rgb(1, 1, 1);
const BODY = rgb(32 / 255, 48 / 255, 66 / 255);
const MUTED = rgb(84 / 255, 103 / 255, 122 / 255);
const WHITE = rgb(1, 1, 1);
const PDF_MIME_TYPE = 'application/pdf';

type PdfPage = ReturnType<PDFDocument['addPage']>;
type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

interface PdfRow {
  label: string;
  value: string;
}

interface RenderState {
  pdf: PDFDocument;
  regularFont: PdfFont;
  emphasisFont: PdfFont;
  page: PdfPage;
  pageNumber: number;
  cursorTop: number;
}

function pdfSafeText(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/\u00a0/g, ' ');
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || 'Non renseigné';
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

function drawPageChrome(state: RenderState) {
  const { page, regularFont, emphasisFont } = state;
  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 78,
    width: page.getWidth(),
    height: 78,
    color: PRIMARY,
  });
  page.drawText('FLASHOVER 78', {
    x: PAGE_MARGIN,
    y: page.getHeight() - 27,
    size: 9,
    font: emphasisFont,
    color: WHITE,
  });
  page.drawText('Demande de réparation d’équipement', {
    x: PAGE_MARGIN,
    y: page.getHeight() - 51,
    size: 17,
    font: emphasisFont,
    color: WHITE,
  });
  page.drawLine({
    start: { x: PAGE_MARGIN, y: 39 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: 39 },
    thickness: 0.5,
    color: OUTLINE,
  });
  page.drawText(`GFO 78 · Page ${state.pageNumber}`, {
    x: PAGE_MARGIN,
    y: 24,
    size: 8,
    font: regularFont,
    color: MUTED,
  });
}

function addPage(state: RenderState) {
  state.page = state.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.pageNumber += 1;
  state.cursorTop = BODY_TOP;
  drawPageChrome(state);
}

function ensureSpace(state: RenderState, requiredHeight: number) {
  if (state.cursorTop + requiredHeight <= BODY_BOTTOM) return;
  addPage(state);
}

function drawSectionTitle(state: RenderState, title: string) {
  const height = 27;
  ensureSpace(state, height + 12);
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
    font: state.emphasisFont,
    color: PRIMARY,
  });
  state.cursorTop += height + 10;
}

function drawGrid(state: RenderState, rows: PdfRow[]) {
  const gap = 12;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;
  const labelSize = 7.5;
  const valueSize = 10;
  const lineHeight = 13;

  for (let index = 0; index < rows.length; index += 2) {
    const pair = rows.slice(index, index + 2);
    const wrapped = pair.map((row) => wrapText(
      state.regularFont,
      row.value,
      valueSize,
      columnWidth - 24,
    ));
    const rowHeight = Math.max(49, ...wrapped.map((lines) => 27 + lines.length * lineHeight));
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
        font: state.emphasisFont,
        color: MUTED,
      });
      wrapped[pairIndex].forEach((line, lineIndex) => {
        state.page.drawText(line || ' ', {
          x: x + 12,
          y: y + rowHeight - 35 - lineIndex * lineHeight,
          size: valueSize,
          font: state.regularFont,
          color: BODY,
        });
      });
    });

    state.cursorTop += rowHeight + 8;
  }
}

function drawFullField(state: RenderState, label: string, value: string) {
  const valueSize = 10;
  const lineHeight = 13;
  let lines = wrapText(state.regularFont, value, valueSize, CONTENT_WIDTH - 24);
  let continuation = false;

  while (lines.length > 0) {
    if (BODY_BOTTOM - state.cursorTop < 70) {
      addPage(state);
      continue;
    }

    const maxLines = Math.max(1, Math.floor((BODY_BOTTOM - state.cursorTop - 42) / lineHeight));
    const chunk = lines.slice(0, maxLines);
    lines = lines.slice(maxLines);
    const height = Math.max(60, 35 + chunk.length * lineHeight);
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
    state.page.drawText(pdfSafeText(continuation ? `${label} - suite` : label).toUpperCase(), {
      x: PAGE_MARGIN + 12,
      y: y + height - 16,
      size: 7.5,
      font: state.emphasisFont,
      color: MUTED,
    });
    chunk.forEach((line, lineIndex) => {
      state.page.drawText(line || ' ', {
        x: PAGE_MARGIN + 12,
        y: y + height - 35 - lineIndex * lineHeight,
        size: valueSize,
        font: state.regularFont,
        color: BODY,
      });
    });
    state.cursorTop += height + 8;
    continuation = true;

    if (lines.length > 0) addPage(state);
  }
}

function getPdfValues(data: EquipmentRepairRequestFormData) {
  return {
    lieu: getEquipmentRepairRequestLocationLabel(data),
    date: data.dateDemande ? formatEquipmentRepairRequestDate(data.dateDemande) : 'Non renseignée',
    email: displayValue(data.emailDemandeur),
    demande: displayValue(data.demandeConcerne),
    equipement: getEquipmentRepairRequestEquipmentLabel(data),
    inventaire: displayValue(data.numeroInventaire),
    nom: displayValue(data.nomDemandeur),
    probleme: displayValue(data.probleme),
  };
}

export async function renderEquipmentRepairRequestPdf(data: EquipmentRepairRequestFormData) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const emphasisFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const state: RenderState = {
    pdf,
    regularFont,
    emphasisFont,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    pageNumber: 1,
    cursorTop: BODY_TOP,
  };
  drawPageChrome(state);

  const values = getPdfValues(data);
  drawSectionTitle(state, 'Informations générales');
  drawGrid(state, [
    { label: 'Lieu de formation', value: values.lieu },
    { label: 'Date', value: values.date },
    { label: 'Adresse mail du demandeur (@sdis78.fr)', value: values.email },
    { label: 'La demande concerne', value: values.demande },
  ]);

  drawSectionTitle(state, data.demandeConcerne || 'Détail de la demande');
  const equipmentRow = {
    label: data.demandeConcerne === 'Habillement'
      ? 'Quel est le matériel concerné :'
      : 'Matériel concerné :',
    value: values.equipement,
  };
  const inventoryRow = { label: 'Numéro d’inventaire :', value: values.inventaire };
  const requesterRow = { label: 'Nom du demandeur :', value: values.nom };

  if (data.demandeConcerne === 'Matériel') {
    drawGrid(state, [equipmentRow]);
    drawFullField(state, 'Description du problème rencontré :', values.probleme);
    drawGrid(state, [inventoryRow, requesterRow]);
  } else {
    drawGrid(state, [equipmentRow, inventoryRow]);
    drawFullField(state, 'Problème rencontré :', values.probleme);
    drawGrid(state, [requesterRow]);
  }

  pdf.setTitle('Demande de réparation d’équipement');
  pdf.setAuthor('Flashover 78');
  const bytes = await pdf.save();
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  return new Blob([pdfArrayBuffer], { type: PDF_MIME_TYPE });
}
