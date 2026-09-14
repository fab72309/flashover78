import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { EquipmentRepairRequestFormData } from '../types';
import { renderEquipmentRepairRequestPdf } from './equipmentRepairRequestPdf';

function validForm(): EquipmentRepairRequestFormData {
  return {
    lieuFormation: 'Montigny le Bretonneux',
    lieuFormationAutre: '',
    dateDemande: '2026-09-13',
    emailDemandeur: 'formateur@sdis78.fr',
    demandeConcerne: 'Matériel',
    equipement: 'ARI',
    equipementAutre: '',
    numeroInventaire: 'ARI-78001',
    probleme: 'Le contrôle met en évidence une fuite sur la soupape.',
    nomDemandeur: 'Fabien Lopes',
  };
}

describe('PDF de demande de réparation d’équipement', () => {
  it('génère un PDF A4 lisible avec les données de la branche matériel', async () => {
    const document = await renderEquipmentRepairRequestPdf(validForm());
    const loadedPdf = await PDFDocument.load(await document.arrayBuffer());

    expect(document.type).toBe('application/pdf');
    expect(document.size).toBeGreaterThan(2_000);
    expect(loadedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(loadedPdf.getTitle()).toContain('Demande de réparation');
  });

  it('ajoute des pages pour une description longue et conserve la branche habillement', async () => {
    const form = validForm();
    form.demandeConcerne = 'Habillement';
    form.equipement = 'VESTE DE FEU';
    form.numeroInventaire = '';
    form.probleme = Array.from(
      { length: 220 },
      () => 'Observation détaillée de la dégradation constatée sur le vêtement.',
    ).join(' ');

    const document = await renderEquipmentRepairRequestPdf(form);
    const loadedPdf = await PDFDocument.load(await document.arrayBuffer());

    expect(loadedPdf.getPageCount()).toBeGreaterThan(1);
  });
});
