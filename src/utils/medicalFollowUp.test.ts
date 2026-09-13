import { describe, expect, it } from 'vitest';
import type { AppUser, MedicalFollowUpFormData } from '../types';
import {
  createInitialMedicalFollowUpForm,
  canAccessMedicalFollowUp,
  canEditMedicalFollowUp,
  formatMedicalFollowUpDate,
  getMedicalFollowUpFilename,
  getMedicalFollowUpFunctionOptions,
  getMedicalFollowUpRoute,
  isMedicalFollowUpEvolution,
  MEDICAL_FOLLOWUP_OPTIONS,
  validateMedicalFollowUpForm,
} from './medicalFollowUp';

const user: AppUser = {
  id: 'user-1',
  email: 'fabien.lopes@sdis78.fr',
  displayName: 'Fabien Lopes',
  firstName: 'Fabien',
  lastName: 'Lopes',
  role: 'member',
  trainerLevels: ['FOR INC'],
  isAdmin: false,
  provider: 'email',
};

function validForm(): MedicalFollowUpFormData {
  return {
    ...createInitialMedicalFollowUpForm(user),
    dateFormation: '2026-09-10',
    conditionsMeteo: 'Soleil',
    hydratationAvantBrulage: '1 l',
    hydratationApresBrulage: '1,5 l',
    lieuFormation: 'MLB TdL / FO',
    formation: 'FAE',
    roleFormateur: 'FOR INC',
    typeBrulage: 'Progression / Attaque',
    tempsAri: '60',
    decontaminationPostBrulage: 'OUI',
    doucheDansHeure: 'Oui',
    observationsPostBrulage: ['Céphalées'],
  };
}

describe('suivi médical formateur', () => {
  it('reprend l’identité du compte connecté', () => {
    const form = createInitialMedicalFollowUpForm(user);

    expect(form.nomFormateur).toBe('Lopes');
    expect(form.prenomFormateur).toBe('Fabien');
    expect(form.emailFormateur).toBe('fabien.lopes@sdis78.fr');
    expect(form.dateFormation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.journee).toBe('Journée complète');
    expect(form.trainerLevel).toBe('FOR INC');
    expect(form.roleFormateur).toBe('FOR INC');
  });

  it('reprend les choix du Google Form', () => {
    expect(MEDICAL_FOLLOWUP_OPTIONS.journee).toEqual(['Journée complète', 'Matin', 'Après-Midi']);
    expect(MEDICAL_FOLLOWUP_OPTIONS.lieuFormation).toEqual([
      'MLB TdL / FO',
      'MLB TdL',
      'MLB FO',
      'MLB MaF',
      'Friche batimentaire',
      'Autre :',
    ]);
    expect(MEDICAL_FOLLOWUP_OPTIONS.roleFormateur).toEqual(['RSFR', 'FOR INC', 'FOR BAT']);
    expect(MEDICAL_FOLLOWUP_OPTIONS.conditionsMeteo).toEqual(['Pluie', 'Soleil', 'Couvert', 'Neige']);
    expect(MEDICAL_FOLLOWUP_OPTIONS.typeBrulage).toContain('Feux réels');
    expect(MEDICAL_FOLLOWUP_OPTIONS.observationsPostBrulage).toContain('Traitement en cours');
  });

  it('ouvre le questionnaire uniquement pour une fonction implémentée du compte', () => {
    expect(canAccessMedicalFollowUp(user)).toBe(true);
    expect(getMedicalFollowUpFunctionOptions(user)).toEqual([
      { level: 'FOR INC', label: 'FOR INC', implemented: true },
    ]);

    const otherUser: AppUser = { ...user, trainerLevels: ['FOR BAT', 'RSFR'] };
    expect(canAccessMedicalFollowUp(otherUser)).toBe(true);
    expect(getMedicalFollowUpFunctionOptions(otherUser)).toEqual([
      { level: 'RSFR', label: 'RSFR', implemented: true },
      { level: 'FOR BAT', label: 'FOR BAT', implemented: true },
    ]);
  });

  it('valide un questionnaire complet', () => {
    expect(validateMedicalFollowUpForm(validForm())).toBeNull();
  });

  it('exige les précisions conditionnelles du formulaire', () => {
    const form = validForm();
    form.lieuFormation = 'Friche batimentaire';

    expect(validateMedicalFollowUpForm(form)).toBe('Précisez le lieu de formation.');

    form.lieuFormationAutre = 'Site complémentaire';
    form.lieuFormation = 'Autre :';
    form.typeBrulage = 'Feux réels';
    expect(validateMedicalFollowUpForm(form)).toBe('Indiquez le nombre de mises à feu dans le champ prévu.');
  });

  it('exige au moins une observation post-brûlage', () => {
    const form = validForm();
    form.observationsPostBrulage = [];

    expect(validateMedicalFollowUpForm(form)).toBe('Sélectionnez au moins une observation post-brûlage.');
  });

  it('formate la date et le nom de fichier', () => {
    const form = validForm();

    expect(formatMedicalFollowUpDate('2026-09-10')).toBe('10/09/2026');
    expect(getMedicalFollowUpFilename(form)).toBe(
      'suivi-medical-formateur-lopes-fabien-2026-09-10.pdf',
    );
    expect(getMedicalFollowUpFilename(form, true)).toBe(
      'evolution-suivi-medical-lopes-fabien-2026-09-10.pdf',
    );
    expect(getMedicalFollowUpRoute('FOR BAT')).toBe('/app/brulage/suivi-medical/FOR%20BAT');
  });

  it('autorise la modification pendant 72 heures', () => {
    const createdAt = new Date('2026-09-10T10:00:00.000Z');
    const record = { createdAt };

    expect(canEditMedicalFollowUp(record, new Date('2026-09-13T09:59:59.000Z'))).toBe(true);
    expect(canEditMedicalFollowUp(record, new Date('2026-09-13T10:00:01.000Z'))).toBe(false);
  });

  it('identifie une fiche générée après modification comme une évolution', () => {
    const createdAt = new Date('2026-09-10T10:00:00.000Z');

    expect(isMedicalFollowUpEvolution({
      createdAt,
      updatedAt: new Date('2026-09-10T10:00:00.500Z'),
    })).toBe(false);
    expect(isMedicalFollowUpEvolution({
      createdAt,
      updatedAt: new Date('2026-09-10T10:01:00.000Z'),
    })).toBe(true);
  });
});
