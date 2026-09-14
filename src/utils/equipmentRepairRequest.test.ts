import { describe, expect, it } from 'vitest';
import type { AppUser, EquipmentRepairRequestFormData } from '../types';
import {
  createInitialEquipmentRepairRequestForm,
  EQUIPMENT_REPAIR_REQUEST_OPTIONS,
  formatEquipmentRepairRequestDate,
  getEquipmentRepairRequestEquipmentLabel,
  getEquipmentRepairRequestFilename,
  getEquipmentRepairRequestLocationLabel,
  getEquipmentRepairRequestRoute,
  validateEquipmentRepairRequestForm,
} from './equipmentRepairRequest';

const user: AppUser = {
  id: 'user-repair-1',
  email: 'formateur@sdis78.fr',
  displayName: 'Fabien Lopes',
  firstName: 'Fabien',
  lastName: 'Lopes',
  role: 'member',
  trainerLevels: ['FOR INC'],
  isAdmin: false,
  provider: 'email',
};

function validForm(): EquipmentRepairRequestFormData {
  return {
    ...createInitialEquipmentRepairRequestForm(user),
    lieuFormation: 'Montigny le Bretonneux',
    dateDemande: '2026-09-13',
    demandeConcerne: 'Matériel',
    equipement: 'ARI',
    probleme: 'La soupape présente une fuite pendant le contrôle.',
    nomDemandeur: 'Fabien Lopes',
  };
}

describe('demande de réparation d’équipement', () => {
  it('reprend exactement les choix des deux branches du questionnaire', () => {
    expect(EQUIPMENT_REPAIR_REQUEST_OPTIONS.lieuxFormation).toEqual([
      'Montigny le Bretonneux',
      'Poissy',
      'Feu réel',
      'Autre :',
    ]);
    expect(EQUIPMENT_REPAIR_REQUEST_OPTIONS.demandes).toEqual(['Matériel', 'Habillement']);
    expect(EQUIPMENT_REPAIR_REQUEST_OPTIONS.materiel).toEqual([
      'ARI',
      'PIECE FACIALE',
      'VENTILATEUR',
      'RIDEAU STOP TIRAGE',
      'LANCE',
      'TUYAUX',
      'POMPE ELECTRIQUE',
      'Autre :',
    ]);
    expect(EQUIPMENT_REPAIR_REQUEST_OPTIONS.habillement).toEqual([
      'VESTE DE FEU',
      'SURPANTALON',
      'SVI HAUT',
      'SVI BAS',
      'CASQUE F1',
      'GANTS DE FEU',
      'Autre :',
    ]);
  });

  it('préremplit la date, l’adresse et le nom du compte connecté', () => {
    const form = createInitialEquipmentRepairRequestForm(user);

    expect(form.dateDemande).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.emailDemandeur).toBe('formateur@sdis78.fr');
    expect(form.nomDemandeur).toBe('Fabien Lopes');
    expect(form.lieuFormation).toBe('');
    expect(form.demandeConcerne).toBe('');
  });

  it('valide une demande de matériel complète', () => {
    expect(validateEquipmentRepairRequestForm(validForm())).toBeNull();
  });

  it('valide la branche habillement avec ses libellés propres', () => {
    const form = validForm();
    form.demandeConcerne = 'Habillement';
    form.equipement = 'GANTS DE FEU';
    form.probleme = 'La couture de la paume est déchirée.';

    expect(validateEquipmentRepairRequestForm(form)).toBeNull();
  });

  it('exige les précisions des choix Autre', () => {
    const form = validForm();
    form.lieuFormation = 'Autre :';

    expect(validateEquipmentRepairRequestForm(form)).toBe('Précisez le lieu de formation.');

    form.lieuFormationAutre = 'Site extérieur';
    form.equipement = 'Autre :';
    expect(validateEquipmentRepairRequestForm(form)).toBe('Précisez le matériel concerné.');

    form.equipementAutre = 'Détecteur de gaz';
    expect(validateEquipmentRepairRequestForm(form)).toBeNull();
  });

  it('refuse un équipement qui appartient à l’autre branche', () => {
    const form = validForm();
    form.equipement = 'CASQUE F1';

    expect(validateEquipmentRepairRequestForm(form)).toBe(
      'Sélectionnez le matériel concerné pour la branche « Matériel ».',
    );
  });

  it('formate la date, les libellés et le nom du PDF', () => {
    const form = validForm();

    expect(formatEquipmentRepairRequestDate('2026-09-13')).toBe('13/09/2026');
    expect(getEquipmentRepairRequestLocationLabel(form)).toBe('Montigny le Bretonneux');
    expect(getEquipmentRepairRequestEquipmentLabel(form)).toBe('ARI');
    expect(getEquipmentRepairRequestFilename(form)).toBe(
      'demande-reparation-materiel-2026-09-13.pdf',
    );
    expect(getEquipmentRepairRequestRoute()).toBe('/app/brulage/demande-reparation');

    form.lieuFormation = 'Autre :';
    form.lieuFormationAutre = 'Centre opérationnel';
    form.equipement = 'Autre :';
    form.equipementAutre = 'Détecteur de gaz';
    expect(getEquipmentRepairRequestLocationLabel(form)).toBe('Autre : Centre opérationnel');
    expect(getEquipmentRepairRequestEquipmentLabel(form)).toBe('Autre : Détecteur de gaz');
  });
});
