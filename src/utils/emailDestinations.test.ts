import { describe, expect, it } from 'vitest';
import {
  mergeEmailRecipients,
  normalizeEmailRecipients,
  validateFormEmailDestinations,
} from './emailDestinations';

describe('destinataires email des formulaires', () => {
  it('normalise les listes saisies et supprime les doublons', () => {
    expect(normalizeEmailRecipients('  A@EXAMPLE.FR, b@example.fr\nA@example.fr; ')).toEqual([
      'a@example.fr',
      'b@example.fr',
    ]);
  });

  it('conserve une liste médicale vide mais exige les deux listes principales', () => {
    const validDestinations = {
      mainCourante: ['main@example.fr'],
      suiviMedical: [],
      demandeReparation: ['repair@example.fr'],
    };

    expect(validateFormEmailDestinations(validDestinations)).toBeNull();
    expect(validateFormEmailDestinations({ ...validDestinations, mainCourante: [] })).toContain(
      'main courante',
    );
    expect(validateFormEmailDestinations({ ...validDestinations, demandeReparation: [] })).toContain(
      'demande de réparation',
    );
  });

  it('inclut toujours l’utilisateur connecté dans le suivi médical', () => {
    expect(mergeEmailRecipients(['formateur@example.fr'], ['admin@example.fr', 'formateur@example.fr'])).toEqual([
      'formateur@example.fr',
      'admin@example.fr',
    ]);
  });

  it('refuse les adresses invalides', () => {
    expect(validateFormEmailDestinations({
      mainCourante: ['main@example.fr'],
      suiviMedical: ['adresse-invalide'],
      demandeReparation: ['repair@example.fr'],
    })).toContain('adresse-invalide');
  });
});
