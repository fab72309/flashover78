import { describe, expect, it } from 'vitest';
import type { AppUser, MainCouranteFormData } from '../types';
import {
  createInitialMainCouranteForm,
  formatMainCouranteDate,
  getMainCouranteFormationOptions,
  getMainCouranteTypeSessionOptions,
  MAIN_COURANTE_LIEU_FORMATION_OPTIONS,
  MAIN_COURANTE_SITES,
  MAIN_COURANTE_TYPE_BRULAGE_OPTIONS,
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
    lieuFormation: 'MLB MaF',
    typeBrulage: 'Observation de l’intérieur',
    typeSession: 'Journée complète',
    formation: 'FI',
    vent: '3',
    sensDuVent: 'Latéral',
    meteo: ['Soleil'],
    formateurs: ['DE ABREU LOPES Fabien', '', '', '', '', '', '', ''],
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
  it('reprend l’identité du compte et les huit emplacements initiaux de formateur', () => {
    const form = createInitialMainCouranteForm(user);

    expect(form.emailFormateur).toBe('fabien.lopes@sdis78.fr');
    expect(form.dateMainCourante).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.formateurs).toHaveLength(8);
    expect(form.formateurRoles).toEqual(['RSFR', 'RSFR', 'FOR INC', 'FOR INC', 'FOR BAT', 'FOR BAT', 'FOR BAT', 'FOR BAT']);
    expect(form.formationAutre).toBe('');
    expect(form.lieuFormation).toBe('');
    expect(form.typeBrulage).toBe('');
  });

  it('reprend les variantes de session et de formation par site', () => {
    expect(MAIN_COURANTE_SITES).toEqual([
      'Montigny le Bretonneux',
      'Feux réels en friche bâtimentaire',
    ]);
    expect(getMainCouranteTypeSessionOptions('Montigny le Bretonneux')).toEqual([
      'Journée complète',
      'Matin',
      'Après-Midi',
    ]);
    expect(getMainCouranteTypeSessionOptions('Feux réels en friche bâtimentaire')).toEqual([
      'FI',
      'FAE',
      'FMA',
      'FMA formateurs',
    ]);
    expect(getMainCouranteFormationOptions('Montigny le Bretonneux')).toEqual([
      'FI',
      'FAE',
      'FMPA GPT/CIS',
      'Feux réels',
      'FMPA Formateurs',
      'Autre :',
    ]);
    expect(getMainCouranteFormationOptions('Feux réels en friche bâtimentaire')).toEqual([]);
    expect(MAIN_COURANTE_LIEU_FORMATION_OPTIONS).toEqual([
      'MLB TdL / FO',
      'MLB TdL',
      'MLB FO',
      'MLB MaF',
      'Friche batimentaire',
      'Autre :',
    ]);
    expect(MAIN_COURANTE_TYPE_BRULAGE_OPTIONS).toEqual([
      'Observation/attaque de l’extérieur',
      'Observation de l’intérieur',
      'Tableau de bord',
      'MEA',
      'Progression / Attaque',
      'Feux réels',
    ]);
  });

  it('valide une main courante complète pour Montigny', () => {
    expect(validateMainCouranteForm(validForm())).toBeNull();
  });

  it('exige une fonction pour chaque formateur saisi', () => {
    const form = validForm();
    form.formateurRoles[0] = '';

    expect(validateMainCouranteForm(form)).toBe('Sélectionnez la fonction du formateur N°1.');
  });

  it('refuse un formateur en double', () => {
    const form = validForm();
    form.formateurs[1] = form.formateurs[0];

    expect(validateMainCouranteForm(form)).toBe('Un même formateur ne peut être renseigné plusieurs fois.');
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
    form.typeSession = 'FI';

    expect(validateMainCouranteForm(form)).toBe('Le type de session ne correspond pas au site sélectionné.');
  });

  it('refuse le site Poissy retiré des nouvelles saisies', () => {
    const form = {
      ...validForm(),
      siteFormation: 'Poissy',
    } as unknown as MainCouranteFormData;

    expect(validateMainCouranteForm(form)).toBe('Sélectionnez un site de formation valide.');
  });

  it('exige une précision lorsque la formation Autre est choisie', () => {
    const form = validForm();
    form.formation = 'Autre :';

    expect(validateMainCouranteForm(form)).toBe('Précisez la formation concernée.');

    form.formationAutre = 'Formation spécifique';
    expect(validateMainCouranteForm(form)).toBeNull();
  });

  it('exige le lieu et le type de brûlage issus du suivi médical', () => {
    const form = validForm();
    form.lieuFormation = '';
    expect(validateMainCouranteForm(form)).toBe('Sélectionnez le lieu de formation.');

    form.lieuFormation = 'Autre :';
    expect(validateMainCouranteForm(form)).toBe('Précisez le lieu de formation.');
    form.lieuFormationAutre = 'Site extérieur';
    expect(validateMainCouranteForm(form)).toBeNull();

    form.typeBrulage = '';
    expect(validateMainCouranteForm(form)).toBe('Sélectionnez le type de brûlage.');

    form.typeBrulage = 'Feux réels';
    expect(validateMainCouranteForm(form)).toBe('Indiquez le nombre de mises à feu dans le champ prévu.');
    form.typeBrulageAutre = '3';
    expect(validateMainCouranteForm(form)).toBeNull();
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
