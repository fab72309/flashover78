import { PDFDocument } from 'pdf-lib';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import type { AppUser, MainCouranteFormData } from '../types';
import { createInitialMainCouranteForm } from './mainCourante';
import { renderMainCourantePdf } from './mainCourantePdf';

const user: AppUser = {
  id: 'user-pdf-1',
  email: 'formateur@sdis78.fr',
  displayName: 'Fabien Lopes',
  firstName: 'Fabien',
  lastName: 'Lopes',
  role: 'member',
  trainerLevels: ['FOR INC'],
  isAdmin: false,
  provider: 'email',
};

function validForm(): MainCouranteFormData {
  return {
    ...createInitialMainCouranteForm(user),
    dateMainCourante: '2026-09-12',
    siteFormation: 'Montigny le Bretonneux',
    lieuFormation: 'MLB MaF',
    typeBrulage: 'Observation de l’intérieur',
    typeSession: 'Journée complète',
    formation: 'FI',
    vent: '3',
    sensDuVent: 'Latéral',
    meteo: ['Soleil', 'Couvert'],
    formateurs: ['DE ABREU LOPES Fabien', 'BOUHOUR Sylvie', '', '', '', '', '', ''],
    citerneGaz: '6',
    panneauxBois: '4',
    palettes: '5',
    masquesFfp3: '3',
    gantsNitrile: '2',
    benneDechet: '2',
    chariotFoyerDemarrage: ['OK'],
    observationsDifficultes: 'Une observation de terrain avec des accents et des informations opérationnelles.',
    reparationsMateriel: 'Prévoir le remplacement d’un élément avant la prochaine session.',
  };
}

describe('main courante PDF', () => {
  beforeAll(async () => {
    const templatePdf = await PDFDocument.create();
    const templatePage = templatePdf.addPage([595.28, 841.89]);
    templatePage.drawRectangle({ x: 0, y: 0, width: 1, height: 1 });
    const template = await templatePdf.save();
    const templateBody = new ArrayBuffer(template.byteLength);
    new Uint8Array(templateBody).set(template);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(templateBody, {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    })));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('génère un PDF A4 lisible avec les données de la session', async () => {
    const document = await renderMainCourantePdf(validForm());
    const loadedPdf = await PDFDocument.load(await document.arrayBuffer());

    expect(document.type).toBe('application/pdf');
    expect(document.size).toBeGreaterThan(2_000);
    expect(loadedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(loadedPdf.getTitle()).toContain('Main courante');
  });

  it('ajoute une page lorsque les observations dépassent la première page', async () => {
    const form = validForm();
    form.observationsDifficultes = Array.from({ length: 180 }, () => 'Observation complémentaire de sécurité terrain.').join(' ');

    const document = await renderMainCourantePdf(form);
    const loadedPdf = await PDFDocument.load(await document.arrayBuffer());

    expect(loadedPdf.getPageCount()).toBeGreaterThan(1);
  });
});
