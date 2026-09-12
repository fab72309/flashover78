import { describe, expect, it } from 'vitest';
import type { AppUser, MainCouranteFormData } from '../types';
import {
  createInitialMainCouranteForm,
  formatMainCouranteDate,
  getMainCouranteFormationOptions,
  getMainCouranteTypeSessionOptions,
  MAIN_COURANTE_FORMATEUR_OPTIONS,
  MAIN_COURANTE_SITES,
  validateMainCouranteForm,
} from './mainCourante';

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

function validForm(): MainCouranteFormData {
  return {
    ...createInitialMainCouranteForm(user),
    siteFormation: 'Montigny le Bretonneux',
    typeSession: '1/2 journée TdL',
    formation: 'FI SPV',
    vent: '3',
    sensDuVent: 'Latéral',
    meteo: ['Soleil'],
    formateurs: ['DE ABREU LOPES Fabien', '', '', '', ''],
    citerneGaz: '5',
    panneauxBois: '2',
    palettes: '3',
    masquesFfp3: '4',
    gantsNitrile: '5',
    benneDechet: '2',
    chariotFoyerDemarrage: ['OK'],
  };
}

describe('main courante', () => {
  it('reprend l’identité du compte et les cinq emplacements de formateur', () => {
    const form = createInitialMainCouranteForm(user);

    expect(form.emailFormateur).toBe('fabien.lopes@sdis78.fr');
    expect(form.dateMainCourante).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.formateurs).toHaveLength(5);
    expect(MAIN_COURANTE_FORMATEUR_OPTIONS).toHaveLength(32);
    expect(MAIN_COURANTE_FORMATEUR_OPTIONS).toContain('VALENTIN Yann');
  });

  it('reprend les variantes de session et de formation par site', () => {
    expect(MAIN_COURANTE_SITES).toEqual([
      'Montigny le Bretonneux',
      'Poissy',
      'Feux réels en friche bâtimentaire',
    ]);
    expect(getMainCouranteTypeSessionOptions('Montigny le Bretonneux')).toEqual([
      '1/2 journée TdL',
      '1/2 journée FO',
      'Journée TdL / FO',
    ]);
    expect(getMainCouranteTypeSessionOptions('Poissy')).toEqual([
      '1/2 journée Progression',
      'Journée Progression',
      'Journée MEA',
    ]);
    expect(getMainCouranteTypeSessionOptions('Feux réels en friche bâtimentaire')).toEqual([
      'FI',
      'FAE',
      'FMA',
      'FMA formateurs',
    ]);
    expect(getMainCouranteFormationOptions('Poissy')).toContain('MEA');
    expect(getMainCouranteFormationOptions('Feux réels en friche bâtimentaire')).toEqual([]);
  });

  it('valide une main courante complète pour Montigny', () => {
    expect(validateMainCouranteForm(validForm())).toBeNull();
  });

  it('valide la branche friche sans formation', () => {
    const form = validForm();
    form.siteFormation = 'Feux réels en friche bâtimentaire';
    form.typeSession = 'FMA formateurs';
    form.formation = '';

    expect(validateMainCouranteForm(form)).toBeNull();
  });

  it('refuse un type de session qui ne correspond pas au site', () => {
    const form = validForm();
    form.siteFormation = 'Poissy';

    expect(validateMainCouranteForm(form)).toBe('Le type de session ne correspond pas au site sélectionné.');
  });

  it('exige la date, le site et la session', () => {
    const form = validForm();
    form.dateMainCourante = '';
    expect(validateMainCouranteForm(form)).toBe('Renseignez la date de la main courante.');

    form.dateMainCourante = '2026-09-12';
    form.siteFormation = '';
    expect(validateMainCouranteForm(form)).toBe('Sélectionnez le site de formation.');

    form.siteFormation = 'Montigny le Bretonneux';
    form.typeSession = '';
    expect(validateMainCouranteForm(form)).toBe('Sélectionnez le type de session.');
  });

  it('formate la date affichée après enregistrement', () => {
    expect(formatMainCouranteDate('2026-09-12')).toBe('12/09/2026');
  });
});
